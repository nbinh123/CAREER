// telegram/keyboards/order.keyboard.js
//
// Bàn phím submenu "📦 Đơn hàng".
const { backToMenuButton } = require("./common.keyboard");

const orderKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🆕 5 đơn gần nhất", callback_data: "orders:recent" }],
            [{ text: "👨‍🍳 Hàng đợi bếp", callback_data: "orders:kitchen" }],
            [{ text: "🍽️ Tình trạng bàn", callback_data: "orders:tables" }],
            [backToMenuButton],
        ],
    },
};

module.exports = { orderKeyboard };
