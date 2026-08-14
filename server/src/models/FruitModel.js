const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Fruit — 1 loại trái cây admin dùng để phối vào combo bán cho khách (VD
 * "Xoài", "Ổi", "Mận"...). Tách hẳn khỏi Food (món ăn) vì đây không phải
 * món bán trực tiếp — khách luôn mua dưới dạng mix 3 loại tại thời điểm
 * đặt (xem FruitPage.jsx phía khách + send_fruit_order trong initSocket.js),
 * không có khái niệm "món trái cây" đứng riêng lẻ trong thực đơn.
 *
 * originalPrice ở đây là đơn giá của RIÊNG loại trái cây này khi nằm trong
 * 1 phần combo — giá 1 combo (3 loại) = tổng originalPrice của 3 loại được
 * chọn, nhân với số phần khách đặt.
 */
const FruitSchema = new Schema(
    {
        fruitName: { type: String, required: true, trim: true, unique: true },
        costPrice: { type: Number, default: 0, min: 0 },
        originalPrice: { type: Number, required: true, min: 0 },
        isAvailable: { type: Boolean, default: true },
        note: { type: String, default: "" },
        imageUrl: { type: String, default: null },
        imagePublicId: { type: String, default: "", trim: true },
    },
    { timestamps: true }
);

FruitSchema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        ret.id = ret._id;
        return ret;
    },
});

module.exports = mongoose.model("Fruit", FruitSchema);
