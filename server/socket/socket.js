const { Server } = require("socket.io");
const Table = require("../src/models/TableModel");
const Food = require("../src/models/FoodModel"); // đổi path nếu FoodModel của bạn nằm chỗ khác

const TABLE_COUNT = 12;

let ioInstance = null;

// Cache RAM: chỉ để trả lời tức thời khi client vừa connect/join,
// KHÔNG còn là nguồn dữ liệu gốc — MongoDB (TableModel) mới là nguồn
// sự thật. Cache được đồng bộ lại sau mỗi lần ghi DB thành công.
let tableCache = [];

// ─── Helpers ──────────────────────────────────────────────────────────────

// Chuẩn hoá 1 document Table (Mongo) về đúng shape mà front-end đang cần.
// pendingItems = món khách gọi, CHỜ admin xác nhận.
// items[].status = "cooking" (đã xác nhận, đang chờ bếp nấu) | "ready" (bếp nấu xong).
// active = admin đã "mở" cho khách gọi món ở bàn này hay chưa. Trang
// OrderPage.jsx phía khách chỉ hiển thị thực đơn khi active === true.
const toClientTable = (t) => ({
    id: t.number,
    name: t.name,
    status: t.status,
    since: t.since,
    items: t.items || [],
    pendingItems: t.pendingItems || [],
    active: !!t.active,
});

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
    }));

    await Table.insertMany(docs);
    console.log(`[socket] Đã tự động seed ${TABLE_COUNT} bàn mặc định (DB chưa có bàn nào)`);
}

async function loadTableCache() {
    const tables = await Table.find().sort({ number: 1 });
    tableCache = tables.map(toClientTable);
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
            console.log("[socket] Đã tải dữ liệu bàn từ MongoDB");
        } catch (err) {
            console.error("[socket] Lỗi khởi tạo dữ liệu bàn:", err.message);
        }
    })();

    io.on("connection", (socket) => {

        // ── 1. Admin: join để thấy TOÀN BỘ bàn (kể cả pendingItems) ──────
        socket.on("join_admin", () => {
            socket.join("admin_room");
            socket.emit("tables_state", tableCache);
        });

        // ── 2. Khách: join theo đúng 1 bàn ────────────────────────────────
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
        // Trang admin trước đây tự thêm/sửa món trực tiếp qua sự kiện này.
        // Giờ trang admin CHỈ xem + xác nhận + thanh toán, không tự order
        // nữa nên front-end không emit sự kiện này. Giữ lại handler ở
        // server phòng khi cần dùng cho mục đích khác sau này.
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
        // Lưu ý: reset KHÔNG đụng tới "active" — bàn thanh toán xong vẫn giữ
        // nguyên trạng thái mở/khoá gọi món do admin đã cấu hình, tránh phải
        // bật lại thủ công cho lượt khách tiếp theo.
        socket.on("checkout_table", async ({ tableId }) => {
            try {
                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { status: "empty", since: null, items: [], pendingItems: [] },
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
                console.error("[socket] checkout_table lỗi:", err.message);
            }
        });

        // ── 6. Khách gửi món (từ OrderPage.jsx phía khách) ────────────────
        // Payload: { tableId, items: [{ foodId, quantity }] }
        // QUAN TRỌNG: món KHÔNG vào thẳng "items"/bếp như trước nữa, mà vào
        // "pendingItems" — chờ admin tick xác nhận rồi mới đẩy sang bếp.
        // Vẫn lấy foodName/unitPrice/emoji từ DB Food, không tin số liệu
        // client gửi lên (tránh khách sửa giá qua devtools).
        socket.on("send_to_kitchen", async ({ tableId, items }) => {
            try {
                if (!tableId || !Array.isArray(items) || items.length === 0) return;

                const table = await Table.findOne({ number: tableId });
                if (!table) return;

                const foodIds = items.map((i) => i.foodId);
                const foodsInDb = await Food.find({ _id: { $in: foodIds } });

                // Set "occupied" + "since" một lần, tách riêng khỏi vòng lặp cập nhật món
                if (table.status !== "occupied" || !table.since) {
                    await Table.findOneAndUpdate(
                        { number: tableId },
                        { status: "occupied", since: table.since ?? new Date() }
                    );
                }

                let updated = null;

                // QUAN TRỌNG: cập nhật TỪNG món bằng thao tác nguyên tử ($inc / $push)
                // thay vì đọc cả mảng rồi ghi đè — cách cũ bị mất dữ liệu khi khách
                // gửi 2 đợt gọi món gần nhau (đợt sau đọc trúng state cũ, ghi đè mất
                // phần đợt trước vừa thêm).
                for (const { foodId, quantity } of items) {
                    const food = foodsInDb.find((f) => String(f._id) === String(foodId));
                    if (!food || !quantity || quantity <= 0) continue;

                    // 1) Món đã có trong pendingItems → cộng dồn số lượng (atomic)
                    let result = await Table.findOneAndUpdate(
                        { number: tableId, "pendingItems.foodId": foodId },
                        {
                            $inc: { "pendingItems.$.quantity": quantity },
                            $set: { "pendingItems.$.submittedAt": new Date() },
                        },
                        { new: true }
                    );

                    // 2) Chưa có món này trong pendingItems → thêm dòng mới (atomic)
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

        // ── 7. Admin xác nhận món đang chờ → chuyển sang "cooking" ────────
        // Payload: { tableId, foodIds }
        // foodIds rỗng/undefined = xác nhận TẤT CẢ món đang pending của bàn đó.
        socket.on("confirm_items", async ({ tableId, foodIds }) => {
            try {
                let idsToConfirm = foodIds;

                // "Xác nhận tất cả" (không truyền foodIds) → lấy đúng danh sách
                // foodId đang pending NGAY LÚC XÁC NHẬN. Nếu khách gửi thêm món mới
                // ngay sau bước đọc này, món đó vẫn còn nguyên trong pendingItems
                // (không bị pull nhầm) và sẽ được xác nhận ở lượt confirm kế tiếp
                // — không mất dữ liệu, chỉ là chưa gộp vào lượt hiện tại.
                if (!idsToConfirm || idsToConfirm.length === 0) {
                    const snap = await Table.findOne({ number: tableId }, { pendingItems: 1 });
                    if (!snap) return;
                    idsToConfirm = (snap.pendingItems || []).map((i) => String(i.foodId));
                    if (idsToConfirm.length === 0) return;
                }

                // QUAN TRỌNG: $pull là thao tác atomic ở tầng DB. Dùng { new: false }
                // để lấy snapshot document TRƯỚC khi pull — nhờ đó biết chính xác
                // số lượng tại đúng thời điểm bị lấy ra khỏi pendingItems, kể cả khi
                // khách vừa $inc thêm số lượng (ở send_to_kitchen) ngay lúc admin
                // bấm xác nhận. Cách cũ (đọc → sửa RAM → ghi đè cả mảng) sẽ làm mất
                // phần vừa cộng thêm đó.
                const beforePull = await Table.findOneAndUpdate(
                    { number: tableId },
                    { $pull: { pendingItems: { foodId: { $in: idsToConfirm } } } },
                    { new: false }
                );
                if (!beforePull) return;

                const pendingBefore = beforePull.pendingItems || [];
                const toConfirm = pendingBefore.filter((i) => idsToConfirm.includes(String(i.foodId)));
                if (toConfirm.length === 0) return;

                const now = new Date();
                let updated = beforePull;

                // Cộng từng món vào items (trạng thái "cooking") bằng thao tác atomic,
                // giống cách làm ở send_to_kitchen — tránh ghi đè cả mảng items.
                for (const p of toConfirm) {
                    let result = await Table.findOneAndUpdate(
                        { number: tableId, items: { $elemMatch: { foodId: p.foodId, status: "cooking" } } },
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
        // Payload: { tableId, foodId }
        socket.on("mark_item_ready", async ({ tableId, foodId }) => {
            try {
                const table = await Table.findOne({ number: tableId });
                if (!table) return;

                const items = table.items.map((i) =>
                    String(i.foodId) === String(foodId) && i.status === "cooking"
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
        // Payload: { tableId, active }  — active là trạng thái MONG MUỐN
        // (true/false), không phải "toggle mù", để tránh lệch state khi 2
        // admin cùng thao tác gần như đồng thời trên cùng 1 bàn.
        // Khi active=false, trang OrderPage.jsx phía khách của đúng bàn đó sẽ
        // tự khoá thực đơn ngay lập tức (và tự mở lại khi active=true) nhờ
        // đang join room `table:{id}` và lắng nghe "tables_state".
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

        // ── 10. Client yêu cầu đồng bộ lại (reconnect, refresh…) ───────────
        socket.on("request_tables", ({ tableId } = {}) => {
            if (tableId) {
                const table = tableCache.find((t) => t.id === Number(tableId));
                socket.emit("tables_state", table ? [table] : []);
            } else {
                socket.emit("tables_state", tableCache);
            }
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