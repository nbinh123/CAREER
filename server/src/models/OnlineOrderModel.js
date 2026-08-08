// models/OnlineOrderModel.js
//
// Đơn hàng của luồng "đặt online" — dự án frontend RIÊNG ("Quán Ba Miền ·
// Đặt món online"), KHÔNG qua bàn/QR. Đơn vị theo dõi là 1 khách ẩn danh
// (customerId — UUID frontend tự sinh, lưu localStorage), không phải tableId.
//
// ⚠️ Field/shape ở đây bám sát ĐÚNG hợp đồng Socket.IO mà frontend đã viết
// sẵn (xem README dự án, mục "Hợp đồng Socket.IO"). ĐỪNG đổi tên field nếu
// không sửa luôn code frontend bên đó — SocketContext.jsx của họ đọc đúng
// các tên: customerId, customerName, phone, address, note,
// items[].foodId/foodName/unitPrice/quantity, totalPrice, status,
// createdAt, updatedAt.

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const onlineOrderItemSchema = new Schema(
    {
        foodId: { type: Schema.Types.ObjectId, ref: "Food", required: true },
        foodName: { type: String, required: true },
        unitPrice: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        // emoji KHÔNG nằm trong hợp đồng frontend (chỉ để trang admin hiển thị
        // trực quan hơn) — field thêm, không phá hợp đồng vì frontend chỉ đọc
        // field nó cần.
        emoji: { type: String, default: "" },
    },
    { _id: false }
);

const onlineOrderSchema = new Schema(
    {
        // UUID ẩn danh frontend tự sinh, lưu localStorage — KHÔNG phải _id của
        // 1 user/account nào (dự án chưa có xác thực, xem README).
        customerId: { type: String, required: true, index: true },

        customerName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        note: { type: String, default: "" },

        items: {
            type: [onlineOrderItemSchema],
            required: true,
            validate: {
                validator: (v) => v.length > 0,
                message: "Đơn hàng phải có ít nhất 1 món",
            },
        },

        totalPrice: { type: Number, required: true, min: 0 },

        // Luồng đầy đủ đúng README frontend:
        // pending → confirmed → preparing → delivering → completed
        // (hoặc → cancelled bất kỳ lúc nào trước completed)
        status: {
            type: String,
            enum: ["pending", "confirmed", "preparing", "delivering", "completed", "cancelled"],
            default: "pending",
        },

        // Các mốc thời gian phụ — KHÔNG nằm trong hợp đồng frontend, chỉ để
        // admin tra cứu/báo cáo nội bộ (vd doanh thu theo ngày hoàn thành).
        cancelReason: { type: String, default: "" },
        confirmedAt: { type: Date, default: null },
        preparingAt: { type: Date, default: null },
        deliveringAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
    },
    { timestamps: true } // createdAt / updatedAt tự động — đúng tên field frontend cần đọc
);

onlineOrderSchema.index({ createdAt: -1 });
onlineOrderSchema.index({ customerId: 1, createdAt: -1 });
onlineOrderSchema.index({ status: 1 });

module.exports = mongoose.model("OnlineOrder", onlineOrderSchema);