const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Log CỐ ĐỊNH của mọi đơn trái cây đã gửi — KHÔNG bị xoá khi checkout_table
 * (khác với Table.fruitOrders, chỉ phản ánh đơn của phiên bàn hiện tại).
 * Giá LUÔN cố định (FRUIT_COMBO_PRICE, xem initSocket.js) — không lưu giá
 * theo từng loại trái cây nữa vì không còn ý nghĩa (tự mix hay combo có
 * sẵn đều cùng 1 giá).
 */
const FruitOrderSchema = new Schema(
    {
        tableId: { type: Number, required: true },
        tableName: String,
        guestName: String,
        guestPhone: String,
        fruits: [
            {
                fruitId: { type: Schema.Types.ObjectId, ref: "Fruit", required: true },
                fruitName: String,
            },
        ],
        // 3 fruitId sort cố định, nối bằng "|" — dùng để GROUP các đơn cùng
        // 1 tổ hợp trái cây lại với nhau bất kể khách chọn theo thứ tự nào.
        comboKey: { type: String, required: true, index: true },
        // Nếu khách chọn trùng đúng 1 combo có sẵn trong menu (Food document)
        // — chỉ mang tính THÔNG TIN cho admin, KHÔNG ảnh hưởng giá.
        matchedComboId: { type: Schema.Types.ObjectId, ref: "Food", default: null },
        matchedComboName: { type: String, default: null },
        quantity: { type: Number, default: 1 },
        totalPrice: { type: Number, default: 0 },
        status: { type: String, default: "pending" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("FruitOrder", FruitOrderSchema);