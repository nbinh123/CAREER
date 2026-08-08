// telegram/callbacks/notify.callback.js
//
// Nút bật/tắt nhận thông báo "có đơn mới" — nằm ngay ở menu chính.
// callback_data = "notify:toggle".
const { toggleNotify } = require("../services/subscriber.service");
const { mainKeyboard } = require("../keyboards/main.keyboard");

module.exports = async function handleNotify(bot, query) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const enabled = await toggleNotify(chatId);

    // null = chưa từng /start (không có subscriber) — hướng dẫn lại
    // thay vì âm thầm không làm gì.
    if (enabled === null) {
        await bot.sendMessage(chatId, "Vui lòng bấm /start trước để đăng ký nhận thông báo.");
        return;
    }

    const statusLine = enabled
        ? "🔔 Đã BẬT thông báo có đơn hàng mới."
        : "🔕 Đã TẮT thông báo có đơn hàng mới.";

    try {
        await bot.editMessageText(`Ông chủ cần gì ạ ^^\n\n${statusLine}`, {
            chat_id: chatId,
            message_id: messageId,
            ...mainKeyboard(enabled),
        });
    } catch (err) {
        await bot.sendMessage(chatId, statusLine, mainKeyboard(enabled));
    }
};
