// telegram/config.js
//
// Đọc toàn bộ biến môi trường mà bot Telegram cần, tập trung 1 chỗ để
// các file khác không phải tự parse process.env rải rác.
require("dotenv").config();

// TELEGRAM_ADMIN_IDS="111111111,222222222" — danh sách chatId Telegram
// (dạng số, xem bằng cách /start rồi gọi getUpdates, hoặc hỏi @userinfobot)
// được phép dùng bot. Để trống = KHÔNG giới hạn, ai /start cũng dùng được
// (tiện lúc mới cài, nhưng bot có số liệu doanh thu nên nên set env này
// khi lên production).
function parseIds(raw) {
    return (raw || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

module.exports = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,

    // Base URL của API backend (Express). Bot gọi thẳng qua HTTP như một
    // client bình thường — không import trực tiếp Controller/Model của
    // src/ để 2 phần (web server & bot) độc lập, dù chạy chung 1 process.
    // Mặc định lấy đúng URL đang dùng trong code cũ (stats.command.js)
    // để không phải cấu hình gì thêm nếu chưa set env.
    API_BASE_URL: (
        process.env.TELEGRAM_API_BASE_URL ||
        process.env.API_BASE_URL ||
        "https://career-tf7j.onrender.com"
    ).replace(/\/+$/, ""),

    ADMIN_CHAT_IDS: parseIds(process.env.TELEGRAM_ADMIN_IDS),
};
