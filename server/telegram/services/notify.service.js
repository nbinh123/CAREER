// telegram/services/notify.service.js
//
// Soạn + gửi tin nhắn "có đơn hàng mới" tới toàn bộ chatId đang mở
// thông báo. Được gọi từ bot.js (export ra notifyNewOrder), và nơi
// tạo Order (OrderController.createOrder) sẽ gọi hàm export đó ngay
// sau khi lưu đơn — xem README.md trong thư mục telegram/ để biết
// chính xác cần thêm dòng nào ở OrderController.js.

const { getActiveSubscriberChatIds } = require("./subscriber.service");
const { money, timeHM } = require("../utils/format");

// order: chính là document Order vừa .save() (OrderModel) — field
// "channel" hiện đang nằm ở TỪNG item (items[].channel), không phải ở
// cấp đơn hàng, nên suy ra "đơn online" bằng cách kiểm tra items.
function describeNewOrder(order) {
    const items = order.items || [];
    const isOnline = items.some((i) => i.channel === "ONLINE");

    const where = order.tableNumber
        ? `🍽️ Bàn ${order.tableNumber}`
        : isOnline
        ? "🛵 Đơn Online"
        : "🧾 Đơn tại quầy";

    const lines = [
        "🛎️ <b>Đơn hàng mới!</b>",
        `${where} · ${timeHM(order.createdAt || new Date())}`,
        "━━━━━━━━━━━━━━━",
        ...items.map(
            (i) => `• ${i.foodName} x${i.quantity}${i.note ? ` (${i.note})` : ""}`
        ),
        "━━━━━━━━━━━━━━━",
        `💰 Tổng: <b>${money(order.totalAmount)}</b>`,
        `💳 ${order.paymentMethod}${order.isPaid ? " — đã thanh toán" : " — chưa thanh toán"}`,
    ];

    // customerName/Phone/Address hiện được định nghĩa ở item schema
    // (OrderModel) — lấy từ item đầu tiên có khai báo, nếu có.
    const custItem = items.find(
        (i) => i.customerName || i.customerPhone || i.customerAddress
    );
    if (custItem) {
        const who = [custItem.customerName, custItem.customerPhone].filter(Boolean).join(" — ");
        if (who) lines.push(`👤 ${who}`);
        if (custItem.customerAddress) lines.push(`📍 ${custItem.customerAddress}`);
    }

    if (order.note) lines.push(`📝 ${order.note}`);

    return lines.join("\n");
}

async function notifyNewOrder(bot, order) {
    if (!bot || !order) return;

    try {
        const chatIds = await getActiveSubscriberChatIds();
        if (chatIds.length === 0) return;

        const text = describeNewOrder(order);

        await Promise.all(
            chatIds.map((chatId) =>
                bot.sendMessage(chatId, text, { parse_mode: "HTML" }).catch((err) =>
                    console.error(`[telegram] Gửi thông báo tới ${chatId} lỗi:`, err.message)
                )
            )
        );
    } catch (err) {
        console.error("[telegram] notifyNewOrder lỗi:", err.message);
    }
}

// ─── Đơn ONLINE vừa đặt (OnlineOrderModel, status: "pending") ──────────────
//
// Khác hẳn shape với document Order thật ở trên: đơn ONLINE lúc này khách
// VỪA đặt, CHƯA admin xác nhận và CHƯA thanh toán, nên không có
// paymentMethod/isPaid/tableNumber — field cũng đặt tên khác (phone/address
// thay vì customerPhone/customerAddress, totalPrice thay vì totalAmount,
// items không có channel/note theo item). Vì vậy soạn riêng 1 hàm thay vì
// gọi describeNewOrder ở trên.
//
// Gọi hàm export notifyNewOnlineOrder ngay sau khi OnlineOrder.create()
// thành công trong socket.js (handler "place_order") — xem README mục 3
// (bản cập nhật) để biết chi tiết.
function describeNewOnlineOrder(order) {
    const items = order.items || [];

    const lines = [
        `🛎️ Thời gian · ${timeHM(order.createdAt || new Date())}`,
        "━━━━━━━━━━━━━━━",
        ...items.map((i) => `• ${i.foodName} x${i.quantity}`),
        "━━━━━━━━━━━━━━━",
        `Tổng: <b>${money(order.totalPrice)}</b>`,
    ];

    const who = [order.customerName, order.phone].filter(Boolean).join(" — ");
    if (who) lines.push(`${who}`);
    if (order.address) lines.push(`${order.address}`);
    if (order.note) lines.push(`${order.note}`);

    return lines.join("\n");
}

async function notifyNewOnlineOrder(bot, order) {
    if (!bot || !order) return;

    try {
        const chatIds = await getActiveSubscriberChatIds();
        if (chatIds.length === 0) return;

        const text = describeNewOnlineOrder(order);

        await Promise.all(
            chatIds.map((chatId) =>
                bot.sendMessage(chatId, text, { parse_mode: "HTML" }).catch((err) =>
                    console.error(`[telegram] Gửi thông báo (online) tới ${chatId} lỗi:`, err.message)
                )
            )
        );
    } catch (err) {
        console.error("[telegram] notifyNewOnlineOrder lỗi:", err.message);
    }
}

module.exports = { notifyNewOrder, describeNewOrder, notifyNewOnlineOrder, describeNewOnlineOrder };