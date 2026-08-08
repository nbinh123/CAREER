// telegram/callbacks/order.callback.js
//
// Xử lý toàn bộ nút trong submenu "📦 Đơn hàng". callback_data dạng
// "orders:<action>".
const api = require("../services/api.service");
const { orderKeyboard } = require("../keyboards/order.keyboard");
const { money, shortDate, timeHM } = require("../utils/format");

async function render(bot, query, text) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            ...orderKeyboard,
        });
    } catch (err) {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", ...orderKeyboard });
    }
}

function describeOrder(o) {
    const isOnline = (o.items || []).some((i) => i.channel === "ONLINE");
    const where = o.tableNumber ? `🍽️ Bàn ${o.tableNumber}` : isOnline ? "🛵 Online" : "🧾 Tại quầy";
    const paidTag = o.isPaid ? "✅ Đã thu" : "⏳ Chưa thu";

    return (
        `${where} · ${money(o.totalAmount)} · ${paidTag}\n` +
        `   ${shortDate(o.createdAt)} ${timeHM(o.createdAt)} — ${(o.items || []).length} món`
    );
}

module.exports = async function handleOrders(bot, query) {
    const [, action] = query.data.split(":");

    switch (action) {
        case "recent": {
            // GET /api/orders trả toàn bộ, đã sort createdAt desc — cắt
            // lấy 5 đơn đầu (xem chú thích trong api.service.js).
            const orders = await api.getOrders();
            const recent = orders.slice(0, 5);

            const text = recent.length
                ? "🆕 <b>5 đơn gần nhất</b>\n━━━━━━━━━━━━━━━\n" + recent.map(describeOrder).join("\n\n")
                : "Chưa có đơn hàng nào.";

            await render(bot, query, text);
            break;
        }

        case "kitchen": {
            // Không có REST endpoint riêng cho hàng đợi bếp — tự suy ra
            // từ GET /api/tables (mỗi item bàn có sẵn field status:
            // "cooking" | "ready", giống logic buildKitchenQueue() trong
            // socket.js).
            const tables = await api.getTables();
            const cooking = tables
                .map((t) => ({
                    name: t.name,
                    items: (t.items || []).filter((i) => i.status === "cooking"),
                }))
                .filter((t) => t.items.length > 0);

            const text = cooking.length
                ? "👨‍🍳 <b>Hàng đợi bếp</b>\n━━━━━━━━━━━━━━━\n" +
                  cooking
                      .map((t) => `<b>${t.name}</b>\n` + t.items.map((i) => `  • ${i.foodName} x${i.quantity}`).join("\n"))
                      .join("\n\n")
                : "🎉 Bếp hiện không có món nào đang chờ nấu.";

            await render(bot, query, text);
            break;
        }

        case "tables": {
            const tables = await api.getTables();
            const occupied = tables.filter((t) => t.status === "occupied");
            const empty = tables.filter((t) => t.status !== "occupied");

            const text =
                "🍽️ <b>Tình trạng bàn</b>\n━━━━━━━━━━━━━━━\n" +
                `🟢 Trống: ${empty.length} bàn\n` +
                `🔴 Đang phục vụ: ${occupied.length} bàn` +
                (occupied.length
                    ? "\n\n" + occupied.map((t) => `• ${t.name} — ${(t.items || []).length} món`).join("\n")
                    : "");

            await render(bot, query, text);
            break;
        }
    }
};
