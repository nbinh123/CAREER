// telegram/commands/start.command.js
//
// DUY NHẤT 1 command: /start. Mọi thao tác khác đều đi qua nút bấm
// (callback_query), không thêm command text nào khác (bỏ /stats cũ).
const { mainKeyboard } = require("../keyboards/main.keyboard");
const { upsertSubscriber } = require("../services/subscriber.service");
const { isAuthorized } = require("../utils/auth");

module.exports = (bot) => {
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;

        if (!isAuthorized(chatId)) {
            await bot.sendMessage(chatId, "🚫 Bạn không có quyền dùng bot này.");
            return;
        }

        try {
            const sub = await upsertSubscriber(chatId, {
                firstName: msg.from?.first_name,
                username: msg.from?.username,
            });

            await bot.sendMessage(chatId, "Ông chủ cần gì ạ ^^", mainKeyboard(sub.notifyNewOrder));
        } catch (err) {
            console.error("[telegram] /start lỗi:", err.message);
            // Vẫn hiện menu dù lưu subscriber lỗi (VD DB tạm mất kết nối)
            // để không "khoá cứng" bot — chỉ nút thông báo sẽ không chính xác.
            await bot.sendMessage(chatId, "Ông chủ cần gì ạ ^^", mainKeyboard(true));
        }
    });
};
