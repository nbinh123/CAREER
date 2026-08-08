const { Server } = require("socket.io");
const Table = require("../src/models/TableModel");
const Food = require("../src/models/FoodModel"); // đổi path nếu FoodModel của bạn nằm chỗ khác
const Fruit = require("../src/models/FruitModel"); // ← THIẾU: send_fruit_order dùng Fruit.find() nhưng chưa từng require — đổi path nếu FruitModel của bạn nằm chỗ khác
const FruitOrder = require("../src/models/FruitOrderModel"); // ← THIẾU: send_fruit_order dùng FruitOrder.create() nhưng chưa từng require — đổi path nếu FruitOrderModel của bạn nằm chỗ khác
const OnlineOrder = require("../src/models/OnlineOrderModel"); // ← MỚI: đơn online (dự án "Quán Ba Miền · Đặt món online") — đổi path nếu bạn đặt model ở chỗ khác
const CustomerChat = require("../src/models/CustomerChatModel"); // ← MỚI: chat hỗ trợ của luồng online, gắn theo customerId

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
async function persistCustomerChatMessage(customerId, from, text) {
    const value = (text || "").trim();
    if (!customerId || !value) return null;

    const message = { from, text: value, at: new Date(), read: from === "admin" };

    const updated = await CustomerChat.findOneAndUpdate(
        { customerId },
        { $push: { messages: message }, $setOnInsert: { customerName: "" } },
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
            console.log("[socket] Đã tải dữ liệu bàn + đơn online + chat online từ MongoDB");
        } catch (err) {
            console.error("[socket] Lỗi khởi tạo dữ liệu bàn:", err.message);
        }
    })();

    io.on("connection", (socket) => {

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

                for (const { foodId, quantity, note } of items) {
                    const food = foodsInDb.find((f) => String(f._id) === String(foodId));
                    if (!food || !quantity || quantity <= 0) continue;

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
                if (customerId) {
                    const savedMessage = await persistCustomerChatMessage(customerId, "customer", text);
                    if (!savedMessage) return;

                    // Bắn NGUYÊN object tin nhắn cho khách — đúng hợp đồng README
                    // ("chat_message" nhận 1 object, không bọc thêm customerId, vì
                    // khách chỉ ở trong đúng 1 room "customer:<id>" của chính họ).
                    io.to(`customer:${customerId}`).emit("chat_message", savedMessage);

                    // Cho admin: bọc thêm customerId để phân biệt được thread nào —
                    // admin có thể đang mở nhiều đơn/nhiều thread cùng lúc.
                    io.to("admin_room").emit("customer_chat_message", { customerId, message: savedMessage });
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
        socket.on("place_order", async ({ customerId, customerName, phone, address, note, items } = {}) => {
            try {
                if (!customerId) return;

                const cleanName = (customerName || "").trim();
                const cleanPhone = (phone || "").trim();
                const cleanAddress = (address || "").trim();
                const cleanNote = (note || "").trim();
                if (!cleanName || !cleanPhone || !cleanAddress) return;
                if (!Array.isArray(items) || items.length === 0) return;

                const foodIds = items.map((i) => i.foodId).filter(Boolean);
                const foodsInDb = await Food.find({ _id: { $in: foodIds } });

                const cleanItems = [];
                for (const { foodId, quantity } of items) {
                    const food = foodsInDb.find((f) => String(f._id) === String(foodId));
                    const qty = Number(quantity);
                    if (!food || !qty || qty <= 0) continue;
                    cleanItems.push({
                        foodId: food._id,
                        foodName: food.foodName,
                        unitPrice: food.originalPrice,
                        quantity: qty,
                        emoji: food.emoji || "",
                    });
                }
                if (cleanItems.length === 0) return;

                const totalPrice = cleanItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

                const created = await OnlineOrder.create({
                    customerId,
                    customerName: cleanName,
                    phone: cleanPhone,
                    address: cleanAddress,
                    note: cleanNote,
                    items: cleanItems,
                    totalPrice,
                    status: "pending",
                });

                // Đồng bộ tên khách vào hồ sơ chat — bản thân sự kiện chat không
                // mang tên khách, nên admin cần lấy tên từ đây để hiện trong danh
                // sách hội thoại thay vì chỉ thấy customerId.
                const chatDoc = await CustomerChat.findOneAndUpdate(
                    { customerId },
                    { $set: { customerName: cleanName }, $setOnInsert: { messages: [] } },
                    { new: true, upsert: true }
                );
                const threadIdx = chatThreadsCache.findIndex((t) => t.customerId === customerId);
                const refreshedThread = toClientChatThread(chatDoc);
                if (threadIdx === -1) chatThreadsCache.unshift(refreshedThread);
                else chatThreadsCache[threadIdx] = refreshedThread;

                const clientOrder = toClientOnlineOrder(created);
                upsertOnlineOrderCache(clientOrder);

                io.to(`customer:${customerId}`).emit("customer_orders_state", getCustomerOrders(customerId));
                io.to("admin_room").emit("online_order_created", clientOrder);
                io.to("admin_room").emit("online_orders_state", onlineOrdersCache);
            } catch (err) {
                console.error("[socket] place_order lỗi:", err.message);
            }
        });

        // ── 18. Admin đổi trạng thái 1 đơn online — dùng chung 1 handler cho
        // cả 5 bước (confirmed/preparing/delivering/completed) lẫn huỷ, thay
        // vì 5 sự kiện riêng, cho gọn phía admin UI. Không cho set "pending"
        // qua đây (đơn luôn bắt đầu pending lúc "place_order").
        socket.on("admin_update_order_status", async ({ orderId, status, reason } = {}) => {
            try {
                if (!orderId || !ONLINE_ORDER_TIMESTAMP_FIELD[status]) return;

                const update = { status, [ONLINE_ORDER_TIMESTAMP_FIELD[status]]: new Date() };
                if (status === "cancelled") update.cancelReason = (reason || "").trim();

                const updated = await OnlineOrder.findByIdAndUpdate(orderId, update, { new: true });
                if (!updated) return;

                const clientOrder = toClientOnlineOrder(updated);
                upsertOnlineOrderCache(clientOrder);

                io.to("admin_room").emit("online_orders_state", onlineOrdersCache);
                io.to(`customer:${clientOrder.customerId}`).emit(
                    "customer_orders_state",
                    getCustomerOrders(clientOrder.customerId)
                );
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