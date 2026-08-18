// services/voucherService.js

const Voucher = require("../../models/VoucherModel");
const VoucherRedemption = require("../../models/VoucherRedemptionModel");

class VoucherError extends Error {}


// items: [{ foodId, categoryId, total }]
async function computeVoucherDiscount(voucher, { channel, items, subtotal, customerKey }) {
    if (!voucher.isCurrentlyValid()) {
        throw new VoucherError("Voucher không còn hiệu lực");
    }

    if (voucher.applicableChannels.length && !voucher.applicableChannels.includes(channel)) {
        throw new VoucherError("Voucher không áp dụng cho kênh này");
    }

    // ❗ MỚI — khớp field applicableCustomerIds vừa thêm vào VoucherModel.
    // Không có customerKey (vd đơn tại quầy, không định danh khách) mà voucher
    // lại giới hạn theo khách cụ thể → luôn coi là không hợp lệ, không đoán.
    if (voucher.applicableCustomerIds.length && (!customerKey || !voucher.applicableCustomerIds.includes(customerKey))) {
        throw new VoucherError("Voucher này không áp dụng cho tài khoản của bạn");
    }

    if (subtotal < voucher.minOrderValue) {
        throw new VoucherError(`Đơn tối thiểu ${voucher.minOrderValue.toLocaleString("vi-VN")}đ để dùng voucher này`);
    }

    // Nếu voucher giới hạn theo món/danh mục, chỉ tính % trên phần hợp lệ
    let eligibleSubtotal = subtotal;
    if (voucher.applicableFoodIds.length || voucher.applicableCategoryIds.length) {
        eligibleSubtotal = items.reduce((sum, item) => {
            const match =
                voucher.applicableFoodIds.some((id) => id.equals(item.foodId)) ||
                voucher.applicableCategoryIds.includes(item.categoryId);
            return match ? sum + item.total : sum;
        }, 0);
    }

    let discount =
        voucher.discountType === "PERCENTAGE"
            ? (eligibleSubtotal * voucher.discountValue) / 100
            : voucher.discountValue;

    if (voucher.maxDiscountAmount !== null) {
        discount = Math.min(discount, voucher.maxDiscountAmount);
    }

    return Math.min(Math.round(discount), subtotal);
}

// Claim lượt dùng NGUYÊN TỬ — tránh 2 khách cùng lúc "ăn" hết voucher giới
// hạn tổng. Nếu bước SAU (tạo Order/OnlineOrder) thất bại, BẮT BUỘC gọi
// rollbackVoucherClaim để trả lại lượt.
async function redeemVoucher(code, { channel, items, subtotal, customerKey }) {
    const voucher = await Voucher.findOne({ code: String(code).toUpperCase().trim() });
    if (!voucher) throw new VoucherError("Voucher không tồn tại");

    if (customerKey && voucher.usageLimitPerCustomer !== null) {
        const usedByCustomer = await VoucherRedemption.countDocuments({
            voucherId: voucher._id,
            customerKey,
            released: false,
        });
        if (usedByCustomer >= voucher.usageLimitPerCustomer) {
            throw new VoucherError("Bạn đã dùng hết lượt cho voucher này");
        }
    }

    // ❗ SỬA — forward customerKey xuống, thiếu dòng này thì check
    // applicableCustomerIds ở trên coi như không có tác dụng khi đặt đơn thật.
    const discountAmount = await computeVoucherDiscount(voucher, { channel, items, subtotal, customerKey });

    const claimed = await Voucher.findOneAndUpdate(
        {
            _id: voucher._id,
            isActive: true,
            $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
    );

    if (!claimed) throw new VoucherError("Voucher đã hết lượt dùng");

    return { voucher: claimed, discountAmount };
}

async function rollbackVoucherClaim(voucherId) {
    await Voucher.updateOne({ _id: voucherId }, { $inc: { usedCount: -1 } }).catch((err) =>
        console.error("[voucherService] rollbackVoucherClaim lỗi:", err.message)
    );
}

// Gọi khi đơn đã tạo THÀNH CÔNG và có dùng voucher.
async function recordVoucherRedemption({ voucherId, code, orderId = null, onlineOrderId = null, customerKey = null, discountApplied }) {
    await VoucherRedemption.create({ voucherId, code, orderId, onlineOrderId, customerKey, discountApplied });
}

// Gọi khi đơn bị huỷ — hoàn lại lượt dùng cho voucher.
async function releaseVoucherForOrder({ orderId = null, onlineOrderId = null }) {
    const filter = orderId ? { orderId, released: false } : { onlineOrderId, released: false };
    const redemption = await VoucherRedemption.findOneAndUpdate(filter, { released: true });
    if (redemption) {
        await Voucher.updateOne({ _id: redemption.voucherId }, { $inc: { usedCount: -1 } });
    }
    return redemption;
}

module.exports = {
    VoucherError,
    computeVoucherDiscount,
    redeemVoucher,
    rollbackVoucherClaim,
    recordVoucherRedemption,
    releaseVoucherForOrder,
};