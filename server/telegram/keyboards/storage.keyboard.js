// telegram/keyboards/storage.keyboard.js
//
// Bàn phím submenu "🥬 Kho nguyên liệu".
const { backToMenuButton } = require("./common.keyboard");

const storageKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "⚠️ Cần chú ý (hết / cần bổ sung)", callback_data: "storage:alert" }],
            [{ text: "📋 Toàn bộ nguyên liệu", callback_data: "storage:all" }],
            [backToMenuButton],
        ],
    },
};

module.exports = { storageKeyboard };
