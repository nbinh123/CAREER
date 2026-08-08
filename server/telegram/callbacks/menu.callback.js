// telegram/callbacks/menu.callback.js
//
// Điều hướng giữa menu chính và 3 submenu (Thống kê / Đơn hàng / Kho).
// callback_data dạng "menu:<screen>" — screen = main | analyst | orders | storage
const { mainKeyboard } = require("../keyboards/main.keyboard");
const { analystKeyboard } = require("../keyboards/analyst.keyboard");
const { orderKeyboard } = require("../keyboards/order.keyboard");
const { storageKeyboard } = require("../keyboards/storage.keyboard");
const { isSubscribed } = require("../services/subscriber.service");

const SCREENS = {
    analyst: {
        text: "📊 <b>Thống kê</b>\nChọn khoảng thời gian bạn muốn xem:",
        keyboard: analystKeyboard,
    },
    orders: {
        text: "📦 <b>Đơn hàng</b>\nChọn thông tin bạn cần xem:",
        keyboard: orderKeyboard,
    },
    storage: {
        text: "🥬 <b>Kho nguyên liệu</b>\nChọn thông tin bạn cần xem:",
        keyboard: storageKeyboard,
    },
};

module.exports = async function handleMenu(bot, query) {
    const [, screen] = query.data.split(":");
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    let text;
    let keyboard;

    if (screen === "main" || !SCREENS[screen]) {
        text = "Ông chủ cần gì ạ ^^";
        keyboard = mainKeyboard(await isSubscribed(chatId));
    } else {
        text = SCREENS[screen].text;
        keyboard = SCREENS[screen].keyboard;
    }

    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            ...keyboard,
        });
    } catch (err) {
        // editMessageText lỗi khi nội dung y hệt cũ, hoặc message quá cũ
        // để sửa — gửi tin nhắn mới thay vì để người dùng không thấy gì.
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", ...keyboard });
    }
};
