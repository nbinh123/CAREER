// telegram/callbacks/index.js
//
// 1 dispatcher DUY NHẤT cho toàn bộ callback_query, thay vì mỗi file
// tự bot.on("callback_query", ...) như code cũ (mỗi lần bấm nút thì
// TẤT CẢ listener đều chạy qua, chỉ return sớm nếu prefix không khớp
// — vừa tốn, vừa dễ tạo bug khi 2 file lỡ check trùng prefix như
// order.callback.js / storage.callback.js bản cũ).
//
// callback_data quy ước dạng "<domain>:<action>[:<param>]", domain
// quyết định file nào xử lý.
const { isAuthorized } = require("../utils/auth");

const handleMenu = require("./menu.callback");
const handleAnalyst = require("./analyst.callback");
const handleOrders = require("./order.callback");
const handleStorage = require("./storage.callback");
const handleNotify = require("./notify.callback");

const ROUTES = {
    menu: handleMenu,
    analyst: handleAnalyst,
    orders: handleOrders,
    storage: handleStorage,
    notify: handleNotify,
};

module.exports = (bot) => {
    bot.on("callback_query", async (query) => {
        const chatId = query.message?.chat?.id;
        const [domain] = (query.data || "").split(":");

        // Trả lời callback NGAY để tắt icon loading trên nút — API phía
        // sau (đặc biệt Render free tier) có thể mất vài giây "thức
        // dậy", không nên giữ callback_query chờ tới lúc đó vì Telegram
        // sẽ báo lỗi "query is too old" nếu để quá lâu.
        bot.answerCallbackQuery(query.id).catch(() => {});

        if (!chatId) return;

        if (!isAuthorized(chatId)) {
            await bot.sendMessage(chatId, "🚫 Bạn không có quyền dùng bot này.").catch(() => {});
            return;
        }

        const handler = ROUTES[domain];
        if (!handler) return;

        try {
            await handler(bot, query);
        } catch (err) {
            console.error(`[telegram] Lỗi xử lý callback "${query.data}":`, err.message);
            await bot.sendMessage(chatId, "⚠️ Đã xảy ra lỗi, vui lòng thử lại.").catch(() => {});
        }
    });
};
