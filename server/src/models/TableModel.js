// models/TableModel.js
//
// Thay thế cho `tableState` (biến JS trong RAM) trong socket.js cũ.
// Mỗi document = 1 bàn, số bàn (`number`) chính là `tableId` mà
// front-end (cả admin lẫn client) đã và đang dùng trong các sự kiện
// socket (update_table, checkout_table...) — KHÔNG đổi sang _id của Mongo
// để tránh phải sửa lại toàn bộ payload phía front-end.

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Món đang có trong "giỏ đang chọn" của bàn (chưa gửi bếp).
// Giữ đúng các field mà tableState cũ đang dùng, kể cả `emoji`.
const tableItemSchema = new Schema(
    {
        foodId: {
            type: Schema.Types.ObjectId,
            ref: "Food",
            required: true,
        },
        foodName: {
            type: String,
            required: true,
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        emoji: {
            type: String,
            default: "",
        },
        // Trong sub-schema của "items" (thêm 2 field):
        status: { type: String, enum: ["cooking", "ready"], default: "cooking" },
        confirmedAt: { type: Date, default: null },
    },
    { _id: false }
);

const tableSchema = new Schema(
    {
        // Số bàn — chính là tableId dùng xuyên suốt hệ thống socket
        number: {
            type: Number,
            required: true,
            unique: true,
        },

        name: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            enum: ["empty", "occupied"],
            default: "empty",
        },

        // Thời điểm bàn bắt đầu có khách / bắt đầu gọi món
        since: {
            type: Date,
            default: null,
        },

        // Giỏ đang chọn, CHƯA gửi bếp (chưa tạo Order)
        items: {
            type: [tableItemSchema],
            default: [],
        },
        pendingItems: {
            type: [
                {
                    foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true },
                    foodName: String,
                    unitPrice: Number,
                    quantity: Number,
                    emoji: String,
                    submittedAt: { type: Date, default: Date.now },
                },
            ],
            default: [],
        },
        messages: {
            type: [
                {
                    from: { type: String, enum: ["guest", "admin"], required: true },
                    text: { type: String, required: true },
                    at: { type: Date, default: Date.now },
                    read: { type: Boolean, default: false }, // chỉ có ý nghĩa với from: "guest"
                },
            ],
            default: [],
        },
        active: { type: Boolean, default: false }
    },

    { timestamps: true }
);

tableSchema.index({ number: 1 });

module.exports = mongoose.model("Table", tableSchema);
