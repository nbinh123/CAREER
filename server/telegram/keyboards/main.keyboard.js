// telegram/keyboards/main.keyboard.js
//
// Bàn phím của menu chính (hiện ra sau /start hoặc khi bấm "Quay lại
// menu"). Nút thông báo đổi nhãn theo trạng thái hiện tại của người
// dùng nên đây là 1 HÀM (nhận notifyEnabled), không phải object tĩnh
// như menu.js cũ.
function mainKeyboard(notifyEnabled) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Thống kê", callback_data: "menu:analyst" }],
                [{ text: "📦 Đơn hàng", callback_data: "menu:orders" }],
                [{ text: "🥬 Kho nguyên liệu", callback_data: "menu:storage" }],
                [
                    {
                        text: notifyEnabled
                            ? "🔔 Thông báo đơn mới: ĐANG BẬT"
                            : "🔕 Thông báo đơn mới: ĐANG TẮT",
                        callback_data: "notify:toggle",
                    },
                ],
            ],
        },
    };
}

module.exports = { mainKeyboard };
