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
// messages = lịch sử chat theo bàn, dùng chung cho cả widget của khách lẫn
// hộp thoại chat của admin.
const toClientTable = (t) => ({
    id: t.number,
    name: t.name,
    status: t.status,
    since: t.since,
    items: t.items || [],
    pendingItems: t.pendingItems || [],
    active: !!t.active,
    messages: (t.messages || []).map((m) => ({
        id: m._id ? String(m._id) : undefined,
        from: m.from,
        text: m.text,
        at: m.at,
        read: m.read,
    })),
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
        messages: [],
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
        // Lưu ý: reset KHÔNG đụng tới "active" và "messages" — lịch sử chat
        // vẫn giữ nguyên qua các lượt khách, chỉ đơn hàng mới bị xoá.
        socket.on("checkout_table", async ({ tableId }) => {
            try {
                const updated = await Table.findOneAndUpdate(
                    { number: tableId },
                    { status: "empty", since: null, items: [], pendingItems: [], messages: [] },
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

        // ── 6. Khách gửi món (từ OrderPage.jsx phía khách) ────────────────
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

                for (const { foodId, quantity } of items) {
                    const food = foodsInDb.find((f) => String(f._id) === String(foodId));
                    if (!food || !quantity || quantity <= 0) continue;

                    let result = await Table.findOneAndUpdate(
                        { number: tableId, "pendingItems.foodId": foodId },
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
        socket.on("confirm_items", async ({ tableId, foodIds }) => {
            try {
                let idsToConfirm = foodIds;

                if (!idsToConfirm || idsToConfirm.length === 0) {
                    const snap = await Table.findOne({ number: tableId }, { pendingItems: 1 });
                    if (!snap) return;
                    idsToConfirm = (snap.pendingItems || []).map((i) => String(i.foodId));
                    if (idsToConfirm.length === 0) return;
                }

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

        // ── 11. Khách gửi tin nhắn chat cho admin ──────────────────────────
        // Bắn thêm "chat_message" (ngoài "tables_state") để phía admin hiện
        // tooltip + tín hiệu trên icon ngay lập tức mà không cần so sánh lại
        // toàn bộ danh sách bàn.
        socket.on("send_chat_message", async ({ tableId, text }) => {
            try {
                const savedMessage = await persistChatMessage(io, tableId, "guest", text);
                if (!savedMessage) return;

                io.to(`table:${tableId}`).emit("chat_message", savedMessage);
                io.to("admin_room").emit("chat_message", { tableId, message: savedMessage });
            } catch (err) {
                console.error("[socket] send_chat_message lỗi:", err.message);
            }
        });

        // ── 12. Admin trả lời tin nhắn cho khách tại 1 bàn ─────────────────
        socket.on("send_admin_chat_message", async ({ tableId, text }) => {
            try {
                const savedMessage = await persistChatMessage(io, tableId, "admin", text);
                if (!savedMessage) return;

                io.to(`table:${tableId}`).emit("chat_message", savedMessage);
                io.to("admin_room").emit("chat_message", { tableId, message: savedMessage });
            } catch (err) {
                console.error("[socket] send_admin_chat_message lỗi:", err.message);
            }
        });

        // ── 13. Admin mở hộp thoại chat của 1 bàn → đánh dấu đã đọc ────────
        // Chỉ đánh dấu các tin nhắn from: "guest" đang read: false, không
        // đụng tới tin nhắn from: "admin" (vốn đã read: true khi tạo).
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