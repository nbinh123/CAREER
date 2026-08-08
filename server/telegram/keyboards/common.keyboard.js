// telegram/keyboards/common.keyboard.js
//
// Nút dùng lại ở nhiều bàn phím khác nhau (tránh lặp lại object y hệt
// nhau ở từng file keyboard).
const backToMenuButton = { text: "⬅️ Quay lại menu", callback_data: "menu:main" };

module.exports = { backToMenuButton };
