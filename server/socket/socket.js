const { Server } = require("socket.io");
const Table = require("../src/models/TableModel");
const Food = require("../src/models/FoodModel"); // đổi path nếu FoodModel của bạn nằm chỗ khác
const Fruit = require("../src/models/FruitModel"); // ← THIẾU: send_fruit_order dùng Fruit.find() nhưng chưa từng require — đổi path nếu FruitModel của bạn nằm chỗ khác
const Voucher = require("../src/models/VoucherModel")
const VoucherRedemption = require("../src/models/VoucherRedemptionModel")
const FruitOrder = require("../src/models/FruitOrderModel"); // ← THIẾU: send_fruit_order dùng FruitOrder.create() nhưng chưa từng require — đổi path nếu FruitOrderModel của bạn nằm chỗ khác
const OnlineOrder = require("../src/models/OnlineOrderModel"); // ← MỚI: đơn online (dự án "Quán Ba Miền · Đặt món online") — đổi path nếu bạn đặt model ở chỗ khác
const CustomerChat = require("../src/models/CustomerChatModel"); // ← MỚI: chat hỗ trợ của luồng online, gắn theo customerId
const { notifyNewOnlineOrder } = require("../telegram/bot"); // ← MỚI: bắn thông báo Telegram ngay khi có đơn online mới — đổi path nếu socket.js không nằm cùng cấp thư mục với telegram/ (xem README trong telegram/)
const Customer = require("../src/models/CustomerModel"); // ← MỚI (mục 3.5 kế hoạch RN): tài khoản khách hàng app mobile — dùng để auto-join phòng đã xác thực, KHÔNG liên quan gì tới luồng web ẩn danh phía dưới
const { verifyCustomerAccessToken } = require("../src/utils/customerToken"); // ← MỚI (mục 3.5 kế hoạch RN): verify access token khách hàng lúc socket connect
const {
    VoucherError,
    computeVoucherDiscount,
    redeemVoucher,
    rollbackVoucherClaim,
    recordVoucherRedemption,
    releaseVoucherForOrder,
} = require("../src/controllers/service/voucherService"); // ❗ MỚI — đổi path nếu bạn đặt khác
const TABLE_COUNT = 12;

let ioInstance = null;

// Cache RAM: chỉ để trả lời tức thời khi client vừa connect/join,
// KHÔNG còn là nguồn dữ liệu gốc — MongoDB (TableModel) mới là nguồn
// sự thật. Cache được đồng bộ lại sau mỗi lần ghi DB thành công.
let tableCache = [];
const FRUIT_COMBO_PRICE = 35000;

// Cache RAM cho đơn online — TẤT CẢ khách, dùng cho trang quản lý admin.
// Cùng nguyên tắc như tableCache: Mongo (OnlineOrder) mới là nguồn sự thật.
// Chỉ giữ tối đa MAX_ONLINE_ORDERS_CACHE đơn gần nhất để tránh phình bộ nhớ
// khi server chạy lâu ngày; lịch sử đầy đủ vẫn luôn còn trong MongoDB.
let onlineOrdersCache = [];
const MAX_ONLINE_ORDERS_CACHE = 300;

// Cache RAM cho danh sách hội thoại chat online (1 phần tử = 1 customerId),
// dùng để admin thấy ngay danh sách "ai đang nhắn tin" mà không cần query
// lại DB mỗi lần. Không giới hạn số lượng — số khách nhắn tin thường ít hơn
// nhiều so với số đơn hàng.
let chatThreadsCache = [];

// Trạng thái nào ứng với field mốc thời gian nào, đồng thời cũng LÀ danh
// sách các trạng thái admin được phép set qua "admin_update_order_status"
// (không cho set lại "pending" — đơn luôn bắt đầu ở pending lúc tạo).
const ONLINE_ORDER_TIMESTAMP_FIELD = {
    confirmed: "confirmedAt",
    preparing: "preparingAt",
    delivering: "deliveringAt",
    completed: "completedAt",
    cancelled: "cancelledAt",
};

// ─── Helpers ──────────────────────────────────────────────────────────────

// Chuẩn hoá 1 document Table (Mongo) về đúng shape mà front-end đang cần.
// pendingItems = món khách gọi, CHỜ admin xác nhận.
// items[].status = "cooking" (đã xác nhận, đang chờ bếp nấu) | "ready" (bếp nấu xong).
// active = admin đã "mở" cho khách gọi món ở bàn này hay chưa. Trang
// OrderPage.jsx phía khách chỉ hiển thị thực đơn khi active === true.
// chatEnabled = admin đã "mở" cho khách gửi tin nhắn ở bàn này hay chưa.
// Mặc định true (chưa từng set trong DB thì vẫn coi là đang mở).
// guestName/guestPhone = tên + SĐT khách nhập ở GuestInfoPage.jsx (phía
// khách) trước khi vào thực đơn — admin thấy trong hộp thoại chat, dạng
// "Bàn 1 - Bình - 0123456789". null nếu khách chưa nhập (hoặc bàn vừa
// được thanh toán/reset).
// messages = lịch sử chat theo bàn, dùng chung cho cả widget của khách lẫn
// hộp thoại chat của admin.
const toClientTable = (t) => ({
    id: t.number,
    name: t.name,
    status: t.status,
    since: t.since,
    items: (t.items || []).map((i) => ({
        id: i._id ? String(i._id) : undefined,
        foodId: i.foodId,
        foodName: i.foodName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        emoji: i.emoji,
        note: i.note || "",
        status: i.status,
        confirmedAt: i.confirmedAt,
    })),
    pendingItems: (t.pendingItems || []).map((i) => ({
        id: i._id ? String(i._id) : undefined,
        foodId: i.foodId,
        foodName: i.foodName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        emoji: i.emoji,
        note: i.note || "",
        submittedAt: i.submittedAt,
    })),
    active: !!t.active,
    chatEnabled: t.chatEnabled !== false,
    guestName: t.guestName || null,
    guestPhone: t.guestPhone || null,
    messages: (t.messages || []).map((m) => ({
        id: m._id ? String(m._id) : undefined,
        from: m.from,
        text: m.text,
        at: m.at,
        read: m.read,
    })),
    fruitOrders: (t.fruitOrders || []).map((o) => ({
        id: o._id ? String(o._id) : undefined,
        guestName: o.guestName,
        guestPhone: o.guestPhone,
        fruits: o.fruits || [],
        quantity: o.quantity,
        matchedComboId: o.matchedComboId ? String(o.matchedComboId) : null,
        matchedComboName: o.matchedComboName || null,
        totalPrice: o.totalPrice,
        status: o.status,
        createdAt: o.createdAt,
    })),
});

// Chuẩn hoá 1 document OnlineOrder (Mongo) về đúng shape cho front-end —
// field names khớp hợp đồng README của client-online (customerId,
// customerName, phone, address, note, items, totalPrice, status,
// createdAt, updatedAt) + vài field phụ cho trang admin (cancelReason,
// các mốc thời gian).
const toClientOnlineOrder = (o) => ({
    id: o._id ? String(o._id) : undefined,
    customerId: o.customerId,
    customerName: o.customerName,
    phone: o.phone,
    address: o.address,
    note: o.note || "",
    items: (o.items || []).map((i) => ({
        foodId: i.foodId,
        foodName: i.foodName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        emoji: i.emoji || "",
    })),
    totalPrice: o.totalPrice,
    status: o.status,
    paymentMethod: o.paymentMethod || null,
    convertedOrderId: o.convertedOrderId ? String(o.convertedOrderId) : null,
    cancelReason: o.cancelReason || "",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    confirmedAt: o.confirmedAt,
    preparingAt: o.preparingAt,
    deliveringAt: o.deliveringAt,
    completedAt: o.completedAt,
    cancelledAt: o.cancelledAt,
});

// Chuẩn hoá 1 document CustomerChat (Mongo) về "1 dòng hội thoại" cho danh
// sách chat phía admin: tên khách (nếu đã biết), tin nhắn cuối, thời gian
// tin cuối, số tin chưa đọc (chỉ đếm tin from: "customer").
function toClientChatThread(doc) {
    const messages = doc.messages || [];
    const last = messages[messages.length - 1];
    const unreadCount = messages.filter((m) => m.from === "customer" && !m.read).length;
    return {
        customerId: doc.customerId,
        customerName: doc.customerName || "",
        phone: doc.phone || "",
        lastMessage: last ? last.text : "",
        lastAt: last ? last.at : doc.updatedAt,
        unreadCount,
    };
}

// Tạo đủ TABLE_COUNT bàn mặc định trong DB nếu chưa có bàn nào
async function ensureTablesSeeded() {
    const count = await Table.countDocuments();
    if (count > 0) return;

    const docs = Array.from({ length: TABLE_COUNT }, (_, i) => ({
        number: i + 1,
        name: `Bàn ${i + 1}`,
        status: "empty",
        since: null,
        items: [],
        pendingItems: [],
        active: false, // mặc định khoá, admin phải chủ động bật cho khách gọi món
        chatEnabled: true, // mặc định mở, admin có thể tắt nếu cần
        guestName: null,
        guestPhone: null,
        messages: [],
        fruitOrders: [],
    }));

    await Table.insertMany(docs);
    console.log(`[socket] Đã tự động seed ${TABLE_COUNT} bàn mặc định (DB chưa có bàn nào)`);
}

async function loadTableCache() {
    const tables = await Table.find().sort({ number: 1 });
    tableCache = tables.map(toClientTable);
}

// Chỉ tải các đơn online GẦN ĐÂY vào cache (đủ dùng cho trang quản lý +
// danh sách của từng khách). Nếu sau này cần xem lịch sử đầy đủ/phân trang
// xa hơn, nên thêm 1 REST endpoint đọc thẳng từ MongoDB thay vì phình cache
// này lên.
async function loadOnlineOrdersCache() {
    const orders = await OnlineOrder.find().sort({ createdAt: -1 }).limit(MAX_ONLINE_ORDERS_CACHE);
    onlineOrdersCache = orders.map(toClientOnlineOrder);
}

async function loadChatThreadsCache() {
    const docs = await CustomerChat.find();
    chatThreadsCache = docs.map(toClientChatThread).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

// Gom danh sách món đang "cooking" theo từng bàn cho trang bếp,
// bàn nào có món chờ lâu nhất thì lên đầu (FIFO).
function buildKitchenQueue() {
    return tableCache
        .map((t) => {
            const cookingItems = (t.items || [])
                .filter((i) => i.status === "cooking")
                .slice()
                .sort((a, b) => new Date(a.confirmedAt || 0) - new Date(b.confirmedAt || 0));
            return { tableId: t.id, tableName: t.name, items: cookingItems };
        })
        .filter((t) => t.items.length > 0)
        .sort((a, b) => new Date(a.items[0].confirmedAt || 0) - new Date(b.items[0].confirmedAt || 0));
}

// Ghi 1 tin nhắn vào bàn, đồng bộ cache + broadcast state đầy đủ, rồi trả về
// tin nhắn vừa lưu (đã có id) để caller bắn thêm sự kiện "chat_message".
async function persistChatMessage(io, tableId, from, text) {
    const value = (text || "").trim();
    if (!tableId || !value) return null;

    const message = { from, text: value, at: new Date(), read: from === "admin" };

    const updated = await Table.findOneAndUpdate(
        { number: tableId },
        { $push: { messages: message } },
        { new: true }
    );
    if (!updated) return null;

    const clientTable = toClientTable(updated);
    const idx = tableCache.findIndex((t) => t.id === tableId);
    if (idx === -1) tableCache.push(clientTable);
    else tableCache[idx] = clientTable;

    io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
    io.to("admin_room").emit("tables_state", tableCache);

    return clientTable.messages[clientTable.messages.length - 1];
}

// Ghi 1 tin nhắn chat ONLINE (theo customerId, KHÔNG theo tableId) — upsert
// document CustomerChat, đồng bộ chatThreadsCache, trả về tin nhắn vừa lưu.
// Không tự emit socket ở đây (khác với persistChatMessage phía trên) vì
// handler gọi hàm này cần emit theo 2 kiểu khác nhau tuỳ ai gửi (khách vs
// admin) — xem "send_chat_message"/"send_admin_chat_message" bên dưới.
// Ghi 1 tin nhắn chat ONLINE (theo customerId, KHÔNG theo tableId) — upsert
// document CustomerChat, đồng bộ chatThreadsCache, trả về tin nhắn vừa lưu.
// customerInfo = { name, phone } — CHỈ truyền khi socket đã xác thực qua
// token (mobile); rỗng {} với luồng web ẩn danh cũ, giữ nguyên hành vi cũ.
// Dùng $set (không phải $setOnInsert) để mỗi tin nhắn mới đều làm mới
// tên/SĐT — phòng trường hợp khách đổi tên/SĐT hồ sơ sau lần chat đầu.
async function persistCustomerChatMessage(customerId, from, text, customerInfo = {}) {
    const value = (text || "").trim();
    if (!customerId || !value) return null;

    const message = { from, text: value, at: new Date(), read: from === "admin" };

    const update = { $push: { messages: message } };
    const setFields = {};
    if (customerInfo.name) setFields.customerName = customerInfo.name;
    if (customerInfo.phone) setFields.phone = customerInfo.phone;

    // Không được vừa $set vừa $setOnInsert trên cùng field (Mongo báo lỗi
    // xung đột) — chỉ chọn 1 trong 2 tuỳ có customerInfo hay không.
    if (Object.keys(setFields).length > 0) {
        update.$set = setFields;
    } else {
        update.$setOnInsert = { customerName: "", phone: "" };
    }

    const updated = await CustomerChat.findOneAndUpdate(
        { customerId },
        update,
        { new: true, upsert: true }
    );
    if (!updated) return null;

    const clientThread = toClientChatThread(updated);
    const idx = chatThreadsCache.findIndex((t) => t.customerId === customerId);
    if (idx === -1) chatThreadsCache.unshift(clientThread);
    else chatThreadsCache[idx] = clientThread;
    chatThreadsCache.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

    const saved = updated.messages[updated.messages.length - 1];
    return { id: String(saved._id), from: saved.from, text: saved.text, at: saved.at };
}

// Cập nhật 1 đơn online trong cache (thêm mới hoặc thay thế theo id), giữ
// cache không vượt quá MAX_ONLINE_ORDERS_CACHE phần tử.
function upsertOnlineOrderCache(clientOrder) {
    const idx = onlineOrdersCache.findIndex((o) => o.id === clientOrder.id);
    if (idx === -1) onlineOrdersCache.unshift(clientOrder);
    else onlineOrdersCache[idx] = clientOrder;
    if (onlineOrdersCache.length > MAX_ONLINE_ORDERS_CACHE) {
        onlineOrdersCache.length = MAX_ONLINE_ORDERS_CACHE;
    }
}

// Toàn bộ đơn (mọi trạng thái) của 1 customerId, mới nhất trước — dùng để
// bắn lại "customer_orders_state" đúng hợp đồng README (mảng đầy đủ, không
// phải 1 đơn lẻ) mỗi khi có đơn mới hoặc đổi trạng thái.
function getCustomerOrders(customerId) {
    return onlineOrdersCache
        .filter((o) => o.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ─── Auto-advance đơn online (SERVER-SIDE) ────────────────────────────────
// ❗ MỚI — thay cho timer 30s trước đây chạy Ở PHÍA CLIENT ADMIN
// (OnlineOrdersPage.jsx, AUTO_ADVANCE_DELAY). Cách cũ chỉ hoạt động khi có
// ít nhất 1 admin đang mở app đúng lúc; nếu không, đơn "kẹt" vĩnh viễn ở
// confirmed/preparing. Chuyển timer vào server để nó luôn chạy, không phụ
// thuộc bất kỳ client nào có đang mở hay không.
//
// LƯU Ý: đây là setTimeout trong bộ nhớ của 1 tiến trình Node — nếu sau này
// chạy nhiều instance server (PM2 cluster, nhiều máy sau load balancer...),
// cách này KHÔNG đủ an toàn (mỗi instance tự lên lịch riêng, dễ chạy đúp).
// Lúc đó cần một job queue thật sự (BullMQ + Redis, agenda.js...). Với 1
// tiến trình Node duy nhất (setup hiện tại) thì cách dưới đây an toàn.
const AUTO_ADVANCE_DELAY_MS = 30000; // phải khớp AUTO_ADVANCE_DELAY (cũ) bên OnlineOrdersPage.jsx
const AUTO_ADVANCE_NEXT_STATUS = { confirmed: "preparing", preparing: "delivering" };
const autoAdvanceTimers = new Map(); // orderId(string) -> timeoutId

function clearAutoAdvanceTimer(orderId) {
    const key = String(orderId);
    const existing = autoAdvanceTimers.get(key);
    if (existing) {
        clearTimeout(existing);
        autoAdvanceTimers.delete(key);
    }
}

// delayMs cho phép truyền riêng — dùng lúc khôi phục timer sau khi server
// restart (xem reconcileOneOrder bên dưới), để không bắt mỗi đơn đợi đủ lại
// từ đầu 30s nếu đã trôi qua một phần thời gian trước khi server tắt.
function scheduleAutoAdvance(io, orderId, fromStatus, delayMs = AUTO_ADVANCE_DELAY_MS) {
    const nextStatus = AUTO_ADVANCE_NEXT_STATUS[fromStatus];
    if (!nextStatus) return;

    clearAutoAdvanceTimer(orderId);

    const key = String(orderId);
    const timeoutId = setTimeout(async () => {
        autoAdvanceTimers.delete(key);
        try {
            // Đọc lại DB tại đúng thời điểm timer chạy, không tin cache — phòng
            // trường hợp admin đã thao tác thủ công (thanh toán/huỷ) trong lúc chờ.
            const current = await OnlineOrder.findById(orderId);
            if (!current || current.status !== fromStatus) return; // đã đổi trạng thái khác rồi, bỏ qua

            await applyOnlineOrderStatusUpdate(io, orderId, nextStatus);
        } catch (err) {
            console.error("[socket] auto-advance lỗi:", err.message);
        }
    }, delayMs);

    autoAdvanceTimers.set(key, timeoutId);
}

// Logic cập nhật trạng thái đơn — TÁCH RIÊNG khỏi handler
// "admin_update_order_status" để dùng chung cho cả thao tác thủ công (admin
// bấm nút) LẪN tự động (auto-advance timer). Giữ nguyên hành vi cũ (set field
// mốc thời gian, cancelReason khi huỷ, hoàn voucher khi huỷ, broadcast state...).
async function applyOnlineOrderStatusUpdate(io, orderId, status, extra = {}) {
    if (!ONLINE_ORDER_TIMESTAMP_FIELD[status]) return null;

    const update = { status, [ONLINE_ORDER_TIMESTAMP_FIELD[status]]: new Date() };
    if (status === "cancelled") update.cancelReason = (extra.reason || "").trim();
    if (status === "completed") {
        if (extra.paymentMethod) update.paymentMethod = extra.paymentMethod;
        if (extra.convertedOrderId) update.convertedOrderId = extra.convertedOrderId;
    }

    const updated = await OnlineOrder.findByIdAndUpdate(orderId, update, { new: true });
    if (!updated) return null;

    if (status === "cancelled") {
        await releaseVoucherForOrder({ onlineOrderId: updated._id });
    }

    clearAutoAdvanceTimer(orderId); // đơn vừa đổi trạng thái — huỷ timer cũ nếu có (tránh chạy đúp)

    const clientOrder = toClientOnlineOrder(updated);
    upsertOnlineOrderCache(clientOrder);

    io.to("admin_room").emit("online_orders_state", onlineOrdersCache);
    io.to(`customer:${clientOrder.customerId}`).emit(
        "customer_orders_state",
        getCustomerOrders(clientOrder.customerId)
    );

    // Đơn vừa vào confirmed/preparing → hẹn giờ tự động chuyển bước kế tiếp.
    if (AUTO_ADVANCE_NEXT_STATUS[status]) {
        scheduleAutoAdvance(io, updated._id, status);
    }

    return clientOrder;
}

// Dùng lúc server vừa khởi động — bắt kịp các đơn đã lỡ hẹn (server bị tắt/
// deploy đúng lúc timer đang chạy dở). Nếu đã quá hạn 30s thì advance ngay 1
// bước; nếu chưa, hẹn giờ lại với đúng phần thời gian còn lại. Bước kế tiếp
// (nếu có) sau đó sẽ tính đủ 30s MỚI kể từ mốc restart này, không cố mô
// phỏng chính xác tuyệt đối từng bước qua thời gian downtime — đủ dùng cho
// các lần restart/deploy thông thường (vài giây đến vài phút).
async function reconcileOneOrder(io, orderId) {
    const order = await OnlineOrder.findById(orderId);
    if (!order) return;
    const nextStatus = AUTO_ADVANCE_NEXT_STATUS[order.status];
    if (!nextStatus) return;

    const startedAt = order[ONLINE_ORDER_TIMESTAMP_FIELD[order.status]];
    const elapsedMs = startedAt ? Date.now() - new Date(startedAt).getTime() : AUTO_ADVANCE_DELAY_MS;
    const remainingMs = AUTO_ADVANCE_DELAY_MS - elapsedMs;

    if (remainingMs <= 0) {
        await applyOnlineOrderStatusUpdate(io, orderId, nextStatus);
    } else {
        scheduleAutoAdvance(io, orderId, order.status, remainingMs);
    }
}

async function reconcileStaleAutoAdvances(io) {
    const orders = await OnlineOrder.find({ status: { $in: Object.keys(AUTO_ADVANCE_NEXT_STATUS) } });
    for (const order of orders) {
        await reconcileOneOrder(io, order._id);
    }
}

// ─── Socket.IO ──────────────────────────────────────────────────────────────
function initSocket(server) {
    const io = new Server(server, {
        cors: { origin: "*" },
    });
    ioInstance = io;

    (async () => {
        try {
            await ensureTablesSeeded();
            await loadTableCache();
            await loadOnlineOrdersCache();
            await loadChatThreadsCache();
            await reconcileStaleAutoAdvances(io); // ❗ MỚI — bắt kịp các đơn lỡ hẹn khi server vừa restart
            console.log("[socket] Đã tải dữ liệu bàn + đơn online + chat online từ MongoDB");
        } catch (err) {
            console.error("[socket] Lỗi khởi tạo dữ liệu bàn:", err.message);
        }
    })();

    io.on("connection", (socket) => {

        // ══════════════════════════════════════════════════════════════════
        // ❗ MỚI (mục 3.5 kế hoạch RN) — Khách (mobile, đã đăng nhập) tự động
        // join phòng riêng bằng access token gửi kèm lúc connect
        // (io-client: `auth: { token }`), KHÔNG chờ client tự bắn sự kiện gì.
        //
        // Tách biệt HOÀN TOÀN với "join_customer" của web ở mục 16 bên dưới —
        // web GIỮ NGUYÊN 100%, không đổi gì cả. accountId lấy từ token ĐÃ
        // VERIFY (KHÔNG lấy customerId client tự khai) nên mobile không dính
        // lỗ hổng "đoán customerId người khác" như thiết kế ẩn danh của web.
        //
        // Không có token (mọi socket web/ẩn danh hiện tại) → bỏ qua hoàn
        // toàn, không ảnh hưởng gì tới hành vi đang chạy.
        // ══════════════════════════════════════════════════════════════════
        (async () => {
            try {
                const token = socket.handshake.auth && socket.handshake.auth.token;
                if (!token) return;

                const decoded = verifyCustomerAccessToken(token);

                const customer = await Customer.findById(decoded.accountId);
                if (!customer) return;
                if (decoded.tokenVersion !== customer.tokenVersion) return;
                if (customer.isLocked) return;

                const accountId = String(customer._id);
                socket.data.customerAccountId = accountId; // đánh dấu socket đã xác thực, phòng khi chỗ khác cần dùng sau này
                socket.data.customerName = customer.fullName || "";
                socket.data.customerPhone = customer.phone || "";

                socket.join(`customer:${accountId}`);
                socket.emit("customer_orders_state", getCustomerOrders(accountId));

                const chatDoc = await CustomerChat.findOne({ customerId: accountId });
                const history = ((chatDoc && chatDoc.messages) || []).map((m) => ({
                    id: String(m._id),
                    from: m.from,
                    text: m.text,
                    at: m.at,
                }));
                socket.emit("chat_history", history);
            } catch (err) {
                // Token sai/hết hạn lúc connect — KHÔNG chặn kết nối socket, chỉ
                // đơn giản là không tự join phòng khách hàng nào cả.
                console.error("[socket] auto-join khách hàng (mobile) lỗi:", err.message);
            }
        })();

        // ── 1. Admin: join để thấy TOÀN BỘ bàn, đơn online, danh sách chat ──
        socket.on("join_admin", () => {
            socket.join("admin_room");
            socket.emit("tables_state", tableCache);
            socket.emit("online_orders_state", onlineOrdersCache);
            socket.emit("chat_threads_state", chatThreadsCache);
        });

        // ── 2. Khách (bản tại bàn): join theo đúng 1 bàn ───────────────────
        socket.on("join_table", ({ tableId }) => {
            socket.join(`table:${tableId}`);
            const table = tableCache.find((t) => t.id === Number(tableId));
            socket.emit("tables_state", table ? [table] : []);
        });

        // ── 3. Bếp: join để nhận hàng đợi món cần nấu ─────────────────────
        socket.on("join_kitchen", () => {
            socket.join("kitchen_room");
            socket.emit("kitchen_state", buildKitchenQueue());
        });

        // ── 4. [Không còn được dùng bởi trang admin] ──────────────────────
        socket.on("update_table", async ({ tableId, items, status, since }) => {
            try {
                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { items, status, since: since ? new Date(since) : null },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
            } catch (err) {
                console.error("[socket] update_table lỗi:", err.message);
            }
        });

        // ── 5. Thanh toán thành công → xoá giỏ, reset bàn về empty ────────
        // Lưu ý: reset KHÔNG đụng tới "active"/"chatEnabled" — các thiết lập
        // bật/tắt vẫn giữ nguyên qua các lượt khách. "messages" VÀ
        // "guestName"/"guestPhone" thì bị xoá cùng nhau, vì khách tiếp theo
        // ngồi vào bàn là một người khác — không được giữ tên/SĐT hay lịch
        // sử chat của khách trước.
        socket.on("checkout_table", async ({ tableId }) => {
            try {
                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    {
                        status: "empty",
                        since: null,
                        items: [],
                        pendingItems: [],
                        messages: [],
                        guestName: null,
                        guestPhone: null,
                        fruitOrders: [],
                    },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
                io.to("kitchen_room").emit("kitchen_state", buildKitchenQueue());
                io.to(`table:${tableId}`).emit("chat_cleared");
            } catch (err) {
                console.error("[socket] checkout_table lỗi:", err.message);
            }
        });

        // ── 6. Khách gửi món (từ OrderPage.jsx phía khách, bản tại bàn) ────
        socket.on("send_to_kitchen", async ({ tableId, items }) => {
            try {
                if (!tableId || !Array.isArray(items) || items.length === 0) return;

                const table = await Table.findOne({ number: tableId });
                if (!table) return;

                const foodIds = items.map((i) => i.foodId);
                const foodsInDb = await Food.find({ _id: { $in: foodIds } });

                if (table.status !== "occupied" || !table.since) {
                    await Table.findOneAndUpdate(
                        { number: tableId },
                        { status: "occupied", since: table.since ?? new Date() }
                    );
                }

                let updated = null;

                // ❗ MỚI — món đã bị tắt "Đang bán" giữa lúc khách mở menu (cache
                // client cũ) và lúc bấm gửi bị loại khỏi đơn ngay tại đây, cùng
                // nguyên tắc "không tin dữ liệu client" với check !food/!quantity
                // sẵn có bên dưới. Gom lại để báo đúng bàn đó biết vì sao món không
                // được gửi, tránh khách tưởng bị lỗi mạng.
                const rejectedItems = [];

                for (const { foodId, quantity, note } of items) {
                    const food = foodsInDb.find((f) => String(f._id) === String(foodId));
                    if (!food || !quantity || quantity <= 0) continue;

                    if (!food.isAvailable) {
                        rejectedItems.push({ foodId: String(food._id), foodName: food.foodName });
                        continue;
                    }

                    const itemNote = note || "";
                    let result = await Table.findOneAndUpdate(
                        { number: tableId, pendingItems: { $elemMatch: { foodId, note: itemNote } } },
                        {
                            $inc: { "pendingItems.$.quantity": quantity },
                            $set: { "pendingItems.$.submittedAt": new Date() },
                        },
                        { new: true }
                    );

                    if (!result) {
                        result = await Table.findOneAndUpdate(
                            { number: tableId },
                            {
                                $push: {
                                    pendingItems: {
                                        foodId: food._id,
                                        foodName: food.foodName,
                                        unitPrice: food.originalPrice,
                                        quantity,
                                        emoji: food.emoji || "",
                                        submittedAt: new Date(),
                                        note: itemNote,
                                    },
                                },
                            },
                            { new: true }
                        );
                    }

                    if (result) updated = result;
                }

                // Báo cho đúng bàn đó biết món nào bị loại — bắn TRƯỚC "if (!updated)
                // return" để dù toàn bộ món trong lượt gửi này đều bị chặn (updated
                // vẫn null), khách vẫn nhận được thông báo thay vì im lặng.
                if (rejectedItems.length > 0) {
                    io.to(`table:${tableId}`).emit("order_items_rejected", { items: rejectedItems });
                }

                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
            } catch (err) {
                console.error("[socket] send_to_kitchen lỗi:", err.message);
            }
        });

        // ── 7. Admin xác nhận món đang chờ (bản tại bàn) → "cooking" ───────
        socket.on("confirm_items", async ({ tableId, pendingItemIds }) => {
            try {
                let idsToConfirm = pendingItemIds;

                if (!idsToConfirm || idsToConfirm.length === 0) {
                    const snap = await Table.findOne({ number: tableId }, { pendingItems: 1 });
                    if (!snap) return;
                    idsToConfirm = (snap.pendingItems || []).map((i) => String(i._id));
                    if (idsToConfirm.length === 0) return;
                }

                const beforePull = await Table.findOneAndUpdate(
                    { number: tableId },
                    { $pull: { pendingItems: { _id: { $in: idsToConfirm } } } },
                    { new: false }
                );
                if (!beforePull) return;

                const pendingBefore = beforePull.pendingItems || [];
                const toConfirm = pendingBefore.filter((i) => idsToConfirm.includes(String(i._id)));
                if (toConfirm.length === 0) return;

                const now = new Date();
                let updated = beforePull;

                for (const p of toConfirm) {
                    let result = await Table.findOneAndUpdate(
                        { number: tableId, items: { $elemMatch: { foodId: p.foodId, status: "cooking", note: p.note || "" } } },
                        { $inc: { "items.$.quantity": p.quantity } },
                        { new: true }
                    );

                    if (!result) {
                        result = await Table.findOneAndUpdate(
                            { number: tableId },
                            {
                                $push: {
                                    items: {
                                        foodId: p.foodId,
                                        foodName: p.foodName,
                                        unitPrice: p.unitPrice,
                                        quantity: p.quantity,
                                        emoji: p.emoji,
                                        note: p.note || "",
                                        status: "cooking",
                                        confirmedAt: now,
                                    },
                                },
                            },
                            { new: true }
                        );
                    }

                    if (result) updated = result;
                }

                if (updated.status !== "occupied") {
                    const statusUpdated = await Table.findOneAndUpdate(
                        { number: tableId },
                        { status: "occupied" },
                        { new: true }
                    );
                    if (statusUpdated) updated = statusUpdated;
                }

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
                io.to("kitchen_room").emit("kitchen_state", buildKitchenQueue());
            } catch (err) {
                console.error("[socket] confirm_items lỗi:", err.message);
            }
        });

        // ── 8. Bếp báo đã nấu xong 1 món của 1 bàn ─────────────────────────
        socket.on("mark_item_ready", async ({ tableId, itemId }) => {
            try {
                const table = await Table.findOne({ number: tableId });
                if (!table) return;

                const items = table.items.map((i) =>
                    String(i._id) === String(itemId) && i.status === "cooking"
                        ? { ...i, status: "ready" }
                        : i
                );

                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { items },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
                io.to("kitchen_room").emit("kitchen_state", buildKitchenQueue());
            } catch (err) {
                console.error("[socket] mark_item_ready lỗi:", err.message);
            }
        });

        // ── 9. Admin bật/tắt cho phép khách gọi món tại 1 bàn ──────────────
        socket.on("toggle_table_active", async ({ tableId, active }) => {
            try {
                if (tableId == null || typeof active !== "boolean") return;

                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { active },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
            } catch (err) {
                console.error("[socket] toggle_table_active lỗi:", err.message);
            }
        });

        // ── 9b. Admin bật/tắt cho phép khách gửi tin nhắn tại 1 bàn ────────
        socket.on("toggle_table_chat", async ({ tableId, chatEnabled }) => {
            try {
                if (tableId == null || typeof chatEnabled !== "boolean") return;

                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { chatEnabled },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
            } catch (err) {
                console.error("[socket] toggle_table_chat lỗi:", err.message);
            }
        });

        // ── 9c. Khách gửi tên + SĐT (từ GuestInfoPage.jsx phía khách) ──────
        socket.on("set_guest_info", async ({ tableId, name, phone }) => {
            try {
                if (tableId == null) return;

                const cleanName = (name || "").trim();
                const cleanPhone = (phone || "").trim();
                if (!cleanName || !/^[0-9]{10}$/.test(cleanPhone)) return;

                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { guestName: cleanName, guestPhone: cleanPhone },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
            } catch (err) {
                console.error("[socket] set_guest_info lỗi:", err.message);
            }
        });

        // ── 10. Client yêu cầu đồng bộ lại bàn (reconnect, refresh…) ───────
        socket.on("request_tables", ({ tableId } = {}) => {
            if (tableId) {
                const table = tableCache.find((t) => t.id === Number(tableId));
                socket.emit("tables_state", table ? [table] : []);
            } else {
                socket.emit("tables_state", tableCache);
            }
        });

        // ── 11. Gửi tin nhắn chat CHO admin — DÙNG CHUNG cho cả bản tại bàn
        // (tableId) LẪN bản đặt online (customerId), vì 2 dự án frontend
        // riêng biệt đều gọi cùng tên sự kiện "send_chat_message". Phân biệt
        // bằng field nào có mặt trong payload — không đổi tên sự kiện được
        // vì client-online đã hard-code đúng tên này (xem README, mục "Hợp
        // đồng Socket.IO").
        socket.on("send_chat_message", async ({ tableId, customerId, text } = {}) => {
            try {
                // ── Nhánh bản tại bàn (giữ nguyên logic cũ) ──
                if (tableId != null) {
                    const table = tableCache.find((t) => t.id === Number(tableId));
                    if (table && table.chatEnabled === false) return;

                    const savedMessage = await persistChatMessage(io, tableId, "guest", text);
                    if (!savedMessage) return;

                    io.to(`table:${tableId}`).emit("chat_message", savedMessage);
                    io.to("admin_room").emit("chat_message", { tableId, message: savedMessage });
                    return;
                }

                // ── Nhánh bản đặt online ──
                // ❗ SỬA (lỗi mobile không gửi được chat) — app React Native
                // (SocketContext.jsx, mục 3.5) CỐ Ý không gửi customerId trong
                // payload, vì danh tính đã được xác thực qua access token lúc
                // connect (xem khối auto-join ở đầu "connection" phía trên, nơi
                // set socket.data.customerAccountId từ token ĐÃ VERIFY). Trước
                // đây nhánh này chỉ đọc customerId từ payload nên với socket
                // mobile luôn là undefined → tin nhắn bị bỏ qua âm thầm.
                // Ưu tiên accountId đã verify (an toàn hơn, không tin client tự
                // khai); chỉ dùng customerId từ payload khi socket CHƯA xác thực
                // qua token — tức luồng web ẩn danh cũ, giữ nguyên hành vi cũ.
                const resolvedCustomerId = socket.data.customerAccountId || customerId;
                if (resolvedCustomerId) {
                    // Chỉ có customerInfo khi socket đã xác thực qua token (mobile) —
                    // luồng web ẩn danh (customerId tự khai) không có hồ sơ để tra.
                    const customerInfo = socket.data.customerAccountId
                        ? { name: socket.data.customerName, phone: socket.data.customerPhone }
                        : {};
                    const savedMessage = await persistCustomerChatMessage(resolvedCustomerId, "customer", text, customerInfo);
                    if (!savedMessage) return;

                    io.to(`customer:${resolvedCustomerId}`).emit("chat_message", savedMessage);
                    io.to("admin_room").emit("customer_chat_message", { customerId: resolvedCustomerId, message: savedMessage });
                    io.to("admin_room").emit("chat_threads_state", chatThreadsCache);
                }
            } catch (err) {
                console.error("[socket] send_chat_message lỗi:", err.message);
            }
        });

        // ── 12. Admin trả lời tin nhắn — DÙNG CHUNG cho cả 2 bản, cùng
        // nguyên tắc phân nhánh như "send_chat_message" ở trên.
        socket.on("send_admin_chat_message", async ({ tableId, customerId, text } = {}) => {
            try {
                if (tableId != null) {
                    const savedMessage = await persistChatMessage(io, tableId, "admin", text);
                    if (!savedMessage) return;

                    io.to(`table:${tableId}`).emit("chat_message", savedMessage);
                    io.to("admin_room").emit("chat_message", { tableId, message: savedMessage });
                    return;
                }

                if (customerId) {
                    const savedMessage = await persistCustomerChatMessage(customerId, "admin", text);
                    if (!savedMessage) return;

                    io.to(`customer:${customerId}`).emit("chat_message", savedMessage);
                    io.to("admin_room").emit("customer_chat_message", { customerId, message: savedMessage });
                    io.to("admin_room").emit("chat_threads_state", chatThreadsCache);
                }
            } catch (err) {
                console.error("[socket] send_admin_chat_message lỗi:", err.message);
            }
        });

        // ── 13. Admin mở hộp thoại chat của 1 bàn → đánh dấu đã đọc ────────
        socket.on("mark_chat_read", async ({ tableId }) => {
            try {
                if (tableId == null) return;

                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { $set: { "messages.$[el].read": true } },
                    { new: true, arrayFilters: [{ "el.from": "guest", "el.read": false }] }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to("admin_room").emit("tables_state", tableCache);
            } catch (err) {
                console.error("[socket] mark_chat_read lỗi:", err.message);
            }
        });

        // ── 14. Admin xoá toàn bộ lịch sử chat của 1 bàn ───────────────────
        socket.on("clear_chat_messages", async ({ tableId }) => {
            try {
                if (tableId == null) return;

                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { messages: [] },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
            } catch (err) {
                console.error("[socket] clear_chat_messages lỗi:", err.message);
            }
        });

        // ── 15. Khách gửi đơn trái cây (FruitPage.jsx phía khách, bản tại bàn) ──
        socket.on("send_fruit_order", async ({ tableId, guestName, phone, fruits, quantity, matchedComboId }) => {
            try {
                if (tableId == null) return;

                const cleanName = (guestName || "").trim();
                const cleanPhone = (phone || "").trim();
                if (!cleanName || !/^[0-9]{10}$/.test(cleanPhone)) return;

                if (!Array.isArray(fruits) || fruits.length !== 3) return;
                const fruitIds = fruits.map((f) => f.fruitId).filter(Boolean);
                if (fruitIds.length !== 3) return;

                const fruitsInDb = await Fruit.find({ _id: { $in: fruitIds } });
                if (fruitsInDb.length !== 3) return; // có fruitId không tồn tại/không hợp lệ

                const cleanFruits = fruitIds.map((id) => {
                    const fruit = fruitsInDb.find((f) => String(f._id) === String(id));
                    return { fruitId: fruit._id, fruitName: fruit.fruitName };
                });

                const cleanQuantity = Number(quantity) > 0 ? Math.floor(Number(quantity)) : 1;
                const cleanTotalPrice = FRUIT_COMBO_PRICE * cleanQuantity;

                const comboKey = fruitIds.map(String).sort().join("|");

                let matchedFood = null;
                if (matchedComboId) {
                    matchedFood = await Food.findById(matchedComboId).catch(() => null);
                }

                const orderFields = {
                    guestName: cleanName,
                    guestPhone: cleanPhone,
                    fruits: cleanFruits,
                    comboKey,
                    matchedComboId: matchedFood ? matchedFood._id : null,
                    matchedComboName: matchedFood ? matchedFood.foodName : null,
                    quantity: cleanQuantity,
                    totalPrice: cleanTotalPrice,
                    status: "pending",
                };

                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { $push: { fruitOrders: { ...orderFields, createdAt: new Date() } } },
                    { new: true }
                );
                if (!updated) return;

                const clientTable = toClientTable(updated);
                const idx = tableCache.findIndex((t) => t.id === tableId);
                if (idx === -1) tableCache.push(clientTable);
                else tableCache[idx] = clientTable;

                const savedOrder = clientTable.fruitOrders[clientTable.fruitOrders.length - 1];

                await FruitOrder.create({ tableId, tableName: clientTable.name, ...orderFields });

                io.to(`table:${tableId}`).emit("tables_state", [clientTable]);
                io.to("admin_room").emit("tables_state", tableCache);
                io.to("admin_room").emit("fruit_order_received", {
                    tableId,
                    tableName: clientTable.name,
                    order: savedOrder,
                });
            } catch (err) {
                console.error("[socket] send_fruit_order lỗi:", err.message);
            }
        });

        // ══════════════════════════════════════════════════════════════════
        // ── LUỒNG ĐẶT ONLINE (dự án "Quán Ba Miền · Đặt món online") ────────
        // Các sự kiện 16-17 khớp ĐÚNG tên + payload README client-online yêu
        // cầu — không đổi tên được vì frontend đã hard-code sẵn. Các sự kiện
        // 18 trở đi (admin_*) do mình tự đặt tên, vì trang quản lý chưa có
        // sẵn (README nói rõ "chưa nằm trong dự án này").
        // ══════════════════════════════════════════════════════════════════

        // ── 16. Khách (online) kết nối → join phòng riêng, nhận đơn + chat cũ ──
        socket.on("join_customer", async ({ customerId } = {}) => {
            try {
                if (!customerId) return;
                socket.join(`customer:${customerId}`);
                socket.emit("customer_orders_state", getCustomerOrders(customerId));

                const chatDoc = await CustomerChat.findOne({ customerId });
                const history = ((chatDoc && chatDoc.messages) || []).map((m) => ({
                    id: String(m._id),
                    from: m.from,
                    text: m.text,
                    at: m.at,
                }));
                socket.emit("chat_history", history);
            } catch (err) {
                console.error("[socket] join_customer lỗi:", err.message);
            }
        });

        // ── 17. Khách (online) đặt đơn — server luôn tự tra Food trong DB để
        // tính lại foodName/unitPrice, KHÔNG tin số liệu client gửi lên, cùng
        // nguyên tắc bảo mật với "send_to_kitchen" ở bản tại bàn.
        socket.on("place_order", async ({ customerId, customerName, phone, address, note, items, voucherCode } = {}) => {
            // ❗ MỚI — rollback nếu OnlineOrder.create thất bại sau khi voucher đã claim
            let claimedVoucherId = null;

            try {
                const resolvedCustomerId = socket.data.customerAccountId || customerId;
                if (!resolvedCustomerId) return;

                const cleanName = (customerName || "").trim();
                const cleanPhone = (phone || "").trim();
                const cleanAddress = (address || "").trim();
                const cleanNote = (note || "").trim();
                if (!cleanName || !cleanPhone || !cleanAddress) return;
                if (!Array.isArray(items) || items.length === 0) return;

                const foodIds = items.map((i) => i.foodId).filter(Boolean);
                const foodsInDb = await Food.find({ _id: { $in: foodIds } });

                const cleanItems = [];
                const rejectedItems = [];

                for (const { foodId, quantity } of items) {
                    const food = foodsInDb.find((f) => String(f._id) === String(foodId));
                    const qty = Number(quantity);
                    if (!food || !qty || qty <= 0) continue;

                    if (!food.isAvailable) {
                        rejectedItems.push({ foodId: String(food._id), foodName: food.foodName });
                        continue;
                    }

                    cleanItems.push({
                        foodId: food._id,
                        foodName: food.foodName,
                        unitPrice: food.originalPrice,
                        quantity: qty,
                        emoji: food.emoji || "",
                    });
                }

                if (rejectedItems.length > 0) {
                    io.to(`customer:${resolvedCustomerId}`).emit("order_items_rejected", { items: rejectedItems });
                }

                if (cleanItems.length === 0) return;

                // ❗ SỬA — đổi tên biến cho rõ nghĩa: đây là số TRƯỚC giảm giá
                const subtotal = cleanItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

                // ❗ MỚI — áp voucher, optional. Client cũ (không gửi voucherCode) đi
                // thẳng qua nhánh này mà không đổi hành vi gì cả.
                let discountAmount = 0;
                let voucherInfo = null;

                if (voucherCode) {
                    try {
                        const eligibilityItems = cleanItems.map((i) => {
                            const food = foodsInDb.find((f) => String(f._id) === String(i.foodId));
                            return { foodId: i.foodId, categoryId: food ? food.categoryId : null, total: i.unitPrice * i.quantity };
                        });

                        const { voucher, discountAmount: voucherDiscount } = await redeemVoucher(voucherCode, {
                            channel: "ONLINE",
                            items: eligibilityItems,
                            subtotal,
                            customerKey: resolvedCustomerId,
                        });
                        claimedVoucherId = voucher._id;
                        discountAmount = voucherDiscount;
                        voucherInfo = voucher;
                    } catch (voucherErr) {
                        io.to(`customer:${resolvedCustomerId}`).emit("order_voucher_rejected", { message: voucherErr.message });
                        return; // không tạo đơn nếu voucher lỗi
                    }
                }

                const totalPrice = Math.max(0, subtotal - discountAmount);

                const created = await OnlineOrder.create({
                    customerId: resolvedCustomerId,
                    customerName: cleanName,
                    phone: cleanPhone,
                    address: cleanAddress,
                    note: cleanNote,
                    items: cleanItems,
                    subtotal, // ❗ MỚI
                    discountAmount, // ❗ MỚI
                    totalPrice,
                    ...(voucherInfo ? { voucherId: voucherInfo._id, voucherCode: voucherInfo.code } : {}), // ❗ MỚI
                    status: "pending",
                });

                if (voucherInfo) { // ❗ MỚI
                    await recordVoucherRedemption({
                        voucherId: voucherInfo._id,
                        code: voucherInfo.code,
                        onlineOrderId: created._id,
                        customerKey: resolvedCustomerId,
                        discountApplied: discountAmount,
                    });
                }

                const clientOrder = toClientOnlineOrder(created);
                upsertOnlineOrderCache(clientOrder);

                io.to(`customer:${resolvedCustomerId}`).emit("customer_orders_state", getCustomerOrders(resolvedCustomerId));
                io.to("admin_room").emit("online_orders_state", onlineOrdersCache);
                io.to("admin_room").emit("online_order_created", clientOrder);

                try {
                    await notifyNewOnlineOrder(clientOrder);
                } catch (notifyErr) {
                    console.error("[socket] notifyNewOnlineOrder lỗi:", notifyErr.message);
                }
            } catch (err) {
                if (claimedVoucherId) await rollbackVoucherClaim(claimedVoucherId); // ❗ MỚI
                console.error("[socket] place_order lỗi:", err.message);
            }
        });

        // ── 17b. Khách (online) xin preview giảm giá TRƯỚC khi đặt — dùng ack
        // callback (KHÁC các handler khác trong file toàn broadcast state), vì đây
        // cần trả lời ĐÚNG 1 lần cho ĐÚNG request đó. KHÔNG claim lượt dùng ở đây —
        // chỉ tính thử, lượt dùng chỉ thật sự bị trừ lúc "place_order" (redeemVoucher).
        socket.on("validate_voucher", async ({ code, items, customerId } = {}, callback) => {
            if (typeof callback !== "function") return; // client cũ không gửi callback → bỏ qua an toàn

            try {
                const resolvedCustomerId = socket.data.customerAccountId || customerId;

                if (!code || !Array.isArray(items) || items.length === 0) {
                    return callback({ success: false, message: "Thiếu thông tin để kiểm tra voucher" });
                }

                const foodIds = items.map((i) => i.foodId).filter(Boolean);
                const foodsInDb = await Food.find({ _id: { $in: foodIds } });

                let subtotal = 0;
                const eligibilityItems = [];
                for (const { foodId, quantity } of items) {
                    const food = foodsInDb.find((f) => String(f._id) === String(foodId));
                    const qty = Number(quantity);
                    if (!food || !qty || qty <= 0) continue;
                    const total = food.originalPrice * qty;
                    subtotal += total;
                    eligibilityItems.push({ foodId: food._id, categoryId: food.categoryId, total });
                }

                const voucher = await Voucher.findOne({ code: String(code).toUpperCase().trim() });
                if (!voucher) return callback({ success: false, message: "Voucher không tồn tại" });

                if (resolvedCustomerId && voucher.usageLimitPerCustomer !== null) {
                    const usedByCustomer = await VoucherRedemption.countDocuments({
                        voucherId: voucher._id,
                        customerKey: resolvedCustomerId,
                        released: false,
                    });
                    if (usedByCustomer >= voucher.usageLimitPerCustomer) {
                        return callback({ success: false, message: "Bạn đã dùng hết lượt cho voucher này" });
                    }
                }

                const discountAmount = await computeVoucherDiscount(voucher, {
                    channel: "ONLINE",
                    items: eligibilityItems,
                    subtotal,
                });

                callback({
                    success: true,
                    code: voucher.code,
                    discountAmount,
                    finalTotal: Math.max(0, subtotal - discountAmount),
                });
            } catch (err) {
                const message = err instanceof VoucherError ? err.message : "Không kiểm tra được voucher, vui lòng thử lại";
                callback({ success: false, message });
            }
        });

        // ── 18. Admin đổi trạng thái 1 đơn online — dùng chung 1 handler cho
        // cả 5 bước (confirmed/preparing/delivering/completed) lẫn huỷ, thay
        // vì 5 sự kiện riêng, cho gọn phía admin UI. Không cho set "pending"
        // qua đây (đơn luôn bắt đầu pending lúc "place_order").
        socket.on("admin_update_order_status", async ({ orderId, status, reason, paymentMethod, convertedOrderId } = {}) => {
            try {
                if (!orderId || !ONLINE_ORDER_TIMESTAMP_FIELD[status]) return;
                // ❗ SỬA — logic cập nhật (set field mốc thời gian, cancelReason,
                // hoàn voucher, broadcast state, hẹn giờ auto-advance kế tiếp nếu
                // có) giờ dùng CHUNG với timer tự động, xem applyOnlineOrderStatusUpdate.
                await applyOnlineOrderStatusUpdate(io, orderId, status, { reason, paymentMethod, convertedOrderId });
            } catch (err) {
                console.error("[socket] admin_update_order_status lỗi:", err.message);
            }
        });

        // ── 19. Admin mở 1 thread chat online → lấy lịch sử + đánh dấu đã đọc.
        // KHÔNG cần socket.join phòng "customer:<id>" ở đây — cập nhật realtime
        // cho admin đã đi qua sự kiện "customer_chat_message" bắn tới cả
        // "admin_room" (xem send_chat_message/send_admin_chat_message ở trên),
        // có kèm customerId để admin tự lọc đúng thread đang mở.
        socket.on("admin_join_customer_chat", async ({ customerId } = {}) => {
            try {
                if (!customerId) return;

                const updated = await CustomerChat.findOneAndUpdate(
                    { customerId },
                    { $set: { "messages.$[el].read": true } },
                    { new: true, arrayFilters: [{ "el.from": "customer", "el.read": false }] }
                );

                const doc = updated || (await CustomerChat.findOne({ customerId }));
                const history = ((doc && doc.messages) || []).map((m) => ({
                    id: String(m._id),
                    from: m.from,
                    text: m.text,
                    at: m.at,
                }));
                socket.emit("chat_history", history);

                if (updated) {
                    const clientThread = toClientChatThread(updated);
                    const idx = chatThreadsCache.findIndex((t) => t.customerId === customerId);
                    if (idx === -1) chatThreadsCache.unshift(clientThread);
                    else chatThreadsCache[idx] = clientThread;
                    io.to("admin_room").emit("chat_threads_state", chatThreadsCache);
                }
            } catch (err) {
                console.error("[socket] admin_join_customer_chat lỗi:", err.message);
            }
        });

        // ── 20. Đồng bộ lại đơn online (reconnect, refresh…) — dùng cho admin.
        socket.on("request_online_orders", () => {
            socket.emit("online_orders_state", onlineOrdersCache);
        });

        socket.on("disconnect", () => { });
    });

    return io;
}

function getIO() {
    if (!ioInstance) {
        throw new Error("Socket.io chưa được khởi tạo (initSocket chưa chạy)");
    }
    return ioInstance;
}

module.exports = { initSocket, getIO };