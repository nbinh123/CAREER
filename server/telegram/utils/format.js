// telegram/utils/format.js
//
// Helper format số tiền / ngày giờ / "biểu đồ" text dùng lại ở nhiều
// callback khác nhau, tránh lặp code.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7, Việt Nam không có DST

// Trả về 1 Date "giả" mà khi gọi getUTC*() sẽ ra đúng giờ VN,
// bất kể server đang chạy ở timezone nào.
function toVNDate(d) {
    return new Date(new Date(d).getTime() + VN_OFFSET_MS);
}

function money(n) {
    return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

function shortDate(d) {
    if (!d) return "";
    const date = toVNDate(d);
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
}

function timeHM(d) {
    if (!d) return "";
    const date = toVNDate(d);
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mm = String(date.getUTCMinutes()).padStart(2, "0");
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