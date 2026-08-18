// models/VoucherModel.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const voucherSchema = new Schema(
    {
        // Tên hiển thị ngắn cho admin xem trong danh sách (vd "Giảm 20.000đ"),
        // khác với `description` (mô tả dài hơn, không bắt buộc).
        name: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        // PERCENTAGE: discountValue là % (0-100). FIXED: discountValue là VNĐ cố định.
        discountType: {
            type: String,
            enum: ["PERCENTAGE", "FIXED"],
            required: true,
        },

        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },

        // Trần giảm khi discountType = PERCENTAGE — tránh giảm % trên đơn lớn
        // thành số tiền vô lý (vd giảm 20% nhưng tối đa 50.000đ).
        maxDiscountAmount: {
            type: Number,
            default: null,
        },

        minOrderValue: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Rỗng = áp dụng cho mọi kênh
        applicableChannels: {
            type: [String],
            enum: ["DINE_IN", "ONLINE"],
            default: [],
        },

        // Rỗng = áp dụng cho mọi món. Khớp Food.categoryId (String).
        applicableCategoryIds: {
            type: [String],
            default: [],
        },

        applicableFoodIds: {
            type: [Schema.Types.ObjectId],
            ref: "Food",
            default: [],
        },

        // Rỗng = áp dụng cho mọi khách. Có giá trị = chỉ đúng những khách này
        // mới dùng được voucher — lưu customerId (web ẩn danh) hoặc
        // accountId.toString() (app mobile đã đăng nhập).
        applicableCustomerIds: {
            type: [String],
            default: [],
        },

        startDate: {
            type: Date,
            default: Date.now,
        },

        endDate: {
            type: Date,
            required: true,
        },

        // null = không giới hạn tổng lượt dùng
        usageLimit: {
            type: Number,
            default: null,
            min: 0,
        },

        // Giới hạn lượt dùng / 1 khách
        usageLimitPerCustomer: {
            type: Number,
            default: 1,
            min: 0,
        },

        usedCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

voucherSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

// Voucher có dùng được NGAY LÚC NÀY hay không — dùng trong voucherService khi
// tính discount/claim lượt dùng thật (khác `status` bên dưới, chỉ để hiển thị).
voucherSchema.methods.isCurrentlyValid = function () {
    const now = new Date();
    if (!this.isActive) return false;
    if (now < this.startDate || now > this.endDate) return false;
    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return false;
    return true;
};

// Trạng thái hiển thị cho trang admin (danh sách + thẻ thống kê) — không
// dùng để validate lúc áp voucher, đó là việc của isCurrentlyValid().
voucherSchema.virtual("status").get(function () {
    const now = new Date();

    if (!this.isActive) return "DISABLED";
    if (now < this.startDate) return "SCHEDULED";
    if (now > this.endDate) return "EXPIRED";
    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return "EXPIRED";

    const daysLeft = (this.endDate - now) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 3) return "EXPIRING_SOON";

    return "ACTIVE";
});

module.exports = mongoose.model("Voucher", voucherSchema);