// telegram/keyboards/analyst.keyboard.js
//
// Bàn phím submenu "📊 Thống kê". Giữ nguyên bàn phím này gắn theo mọi
// kết quả trả về (hôm nay / tuần / tháng / top món) để người dùng bấm
// xem mục khác ngay mà không phải quay lại menu chính.
const { backToMenuButton } = require("./common.keyboard");

const analystKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "📅 Hôm nay", callback_data: "analyst:today" },
                { text: "🔄 7 ngày gần nhất", callback_data: "analyst:7d" },
            ],
            [
                { text: "🗓️ Tuần này", callback_data: "analyst:week:0" },
                { text: "Tuần trước", callback_data: "analyst:week:1" },
            ],
            [
                { text: "📆 Tháng này", callback_data: "analyst:month:0" },
                { text: "Tháng trước", callback_data: "analyst:month:1" },
            ],
            [
                { text: "🏆 Top món (hôm nay)", callback_data: "analyst:top:day" },
                { text: "Top món (tuần)", callback_data: "analyst:top:week" },
            ],
            [backToMenuButton],
        ],
    },
};

module.exports = { analystKeyboard };
