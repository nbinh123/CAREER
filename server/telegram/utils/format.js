// telegram/utils/format.js
//
// Helper format số tiền / ngày giờ / "biểu đồ" text dùng lại ở nhiều
// callback khác nhau, tránh lặp code.

function money(n) {
    return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

function shortDate(d) {
    if (!d) return "";
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
}

function timeHM(d) {
    if (!d) return "";
    const date = new Date(d);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

// Vẽ 1 thanh bar bằng ký tự khối để "biểu đồ hoá" số liệu ngay trong
// tin nhắn text (Telegram không render ảnh động/chart thật).
function bar(value, max, width = 10) {
    if (!max || max <= 0) return "░".repeat(width);
    const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
    return "█".repeat(filled) + "░".repeat(width - filled);
}

module.exports = { money, shortDate, timeHM, bar };
