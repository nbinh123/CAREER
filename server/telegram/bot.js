// telegram/bot.js
//
// Entry point của bot Telegram — được require 1 lần từ express.js lúc
// server khởi động (chỉ để tạo side-effect: kết nối + bắt đầu polling).
//
// Export thêm notifyNewOrder(order) để phần tạo Order (OrderController)
// gọi ngay sau khi lưu đơn thành công — xem README.md để biết chính
// xác cần thêm dòng nào ở đó.
require("dotenv").config();

const { TelegramBot } = require("node-telegram-bot-api");
const { TELEGRAM_TOKEN } = require("./config");
const registerCommands = require("./commands");
const registerCallbacks = require("./callbacks");
const { notifyNewOrder, notifyNewOnlineOrder } = require("./services/notify.service");

let bot = null;

if (!TELEGRAM_TOKEN) {
    console.warn("[telegram] Thiếu TELEGRAM_TOKEN trong .env — bot KHÔNG khởi động.");
} else {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

    registerCommands(bot);
    registerCallbacks(bot);

    bot.on("polling_error", (err) => console.error("[telegram] polling_error:", err.message));

    console.log("[telegram] Bot đã khởi động (polling)");
}

module.exports = {
    bot,
    // Gọi hàm này ngay sau khi 1 Order được lưu thành công.
    // An toàn khi gọi cả lúc bot chưa khởi động (thiếu TELEGRAM_TOKEN)
    // — notifyNewOrder tự bỏ qua nếu bot === null.
    notifyNewOrder: (order) => notifyNewOrder(bot, order),
    // Gọi ngay sau khi 1 OnlineOrder được tạo (status "pending", khách vừa
    // đặt — xem socket.js, handler "place_order"). Cùng nguyên tắc an toàn
    // như trên, tự bỏ qua nếu bot === null.
    notifyNewOnlineOrder: (order) => notifyNewOnlineOrder(bot, order),
};