exports.mainMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "📦 Đơn hàng", callback_data: "orders" }],
            [{ text: "💰 Doanh thu", callback_data: "revenue" }],
            [{ text: "📊 Thống kê", callback_data: "analyst" }],
            [{ text: "🥬 Kho", callback_data: "storage" }]
        ]
    }
};