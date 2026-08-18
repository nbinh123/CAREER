// models/VoucherRedemptionModel.js
//
// Ghi lại MỖI LẦN voucher được áp thành công. Dùng để (1) chặn 1 khách dùng
// vượt usageLimitPerCustomer, (2) hoàn lượt dùng khi đơn bị huỷ.

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const voucherRedemptionSchema = new Schema(
    {
        voucherId: { type: Schema.Types.ObjectId, ref: "Voucher", required: true, index: true },
        code: { type: String, required: true },

        orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
        onlineOrderId: { type: Schema.Types.ObjectId, ref: "OnlineOrder", default: null },

        // customerId (OnlineOrder ẩn danh) hoặc accountId.toString() — null
        // nếu đơn tại bàn không định danh khách.
        customerKey: { type: String, default: null, index: true },

        discountApplied: { type: Number, required: true, min: 0 },
        released: { type: Boolean, default: false }, // true khi đơn bị huỷ, hoàn lại lượt dùng
    },
    { timestamps: true }
);

voucherRedemptionSchema.index({ voucherId: 1, customerKey: 1 });

module.exports = mongoose.model("VoucherRedemption", voucherRedemptionSchema);