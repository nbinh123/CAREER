// telegram/utils/auth.js
//
// Chặn người lạ dùng bot: chỉ chatId có trong TELEGRAM_ADMIN_IDS (.env)
// mới được /start hoặc bấm nút. Không set env này thì mở cho tất cả.
const { ADMIN_CHAT_IDS } = require("../config");

function isAuthorized(chatId) {
    if (ADMIN_CHAT_IDS.length === 0) return true;
    return ADMIN_CHAT_IDS.includes(String(chatId));
}

module.exports = { isAuthorized };
