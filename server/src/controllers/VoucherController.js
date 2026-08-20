// controllers/VoucherController.js

const Voucher = require("../models/VoucherModel");
const VoucherRedemption = require("../models/VoucherRedemptionModel");
const { VoucherError, computeVoucherDiscount } = require("./service/voucherService");

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // chữ in hoa A-Z + số 0-9
const MAX_BATCH_QUANTITY = 1000;
const MAX_GENERATE_ATTEMPTS_MULTIPLIER = 20;

function generateRandomCode(length = 6) {
    let code = "";
    for (let i = 0; i < length; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return code;
}

// Sinh ra `quantity` mã code duy nhất: không trùng nhau trong batch,
// và không trùng với code đã tồn tại trong DB.
async function generateUniqueCodes(quantity, codePrefix, codeLength) {
    const codes = new Set();
    let attempts = 0;
    const maxAttempts = quantity * MAX_GENERATE_ATTEMPTS_MULTIPLIER;

    while (codes.size < quantity) {
        attempts++;
        if (attempts > maxAttempts) {
            throw new Error(
                "Không thể sinh đủ mã voucher duy nhất. Hãy giảm quantity hoặc tăng codeLength."
            );
        }
        codes.add(`${codePrefix}${generateRandomCode(codeLength)}`);
    }

    let codesArray = Array.from(codes);

    // Kiểm tra trùng với DB (hiếm khi xảy ra) rồi sinh bù nếu cần
    const existing = await Voucher.find({ code: { $in: codesArray } })
        .select("code")
        .lean();

    if (existing.length > 0) {
        const existingSet = new Set(existing.map((v) => v.code));
        codesArray = codesArray.filter((c) => !existingSet.has(c));

        const missing = quantity - codesArray.length;
        if (missing > 0) {
            const extra = await generateUniqueCodes(missing, codePrefix, codeLength);
            codesArray = codesArray.concat(extra);
        }
    }

    return codesArray;
}

// Tạo hàng loạt N voucher, mỗi voucher chỉ dùng được 1 lần (usageLimit = 1),
// dùng chung một bộ điều kiện (discount, đơn tối thiểu, kênh áp dụng,
// món áp dụng, thời gian hiệu lực...).
async function buildVoucherBatch(payload) {
    const {
        quantity,
        namePrefix = "Voucher",
        codePrefix = "",
        codeLength = 6,
        description = "",
        discountType,
        discountValue,
        maxDiscountAmount = null,
        minOrderValue = 0,
        applicableChannels = [],
        applicableCategoryIds = [],
        applicableFoodIds = [],
        startDate,
        endDate,
    } = payload;

    // ----- validate -----
    if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("quantity phải là số nguyên >= 1");
    }
    if (quantity > MAX_BATCH_QUANTITY) {
        throw new Error(`quantity không được vượt quá ${MAX_BATCH_QUANTITY}`);
    }
    if (!["PERCENTAGE", "FIXED"].includes(discountType)) {
        throw new Error("discountType phải là PERCENTAGE hoặc FIXED");
    }
    if (typeof discountValue !== "number" || discountValue < 0) {
        throw new Error("discountValue phải là số >= 0");
    }
    if (discountType === "PERCENTAGE" && discountValue > 100) {
        throw new Error("discountValue theo % không được vượt quá 100");
    }
    if (!endDate) {
        throw new Error("endDate là bắt buộc");
    }

    const parsedEndDate = new Date(endDate);
    const parsedStartDate = startDate ? new Date(startDate) : new Date();

    if (isNaN(parsedEndDate.getTime())) {
        throw new Error("endDate không hợp lệ");
    }
    if (startDate && isNaN(parsedStartDate.getTime())) {
        throw new Error("startDate không hợp lệ");
    }
    if (parsedEndDate <= parsedStartDate) {
        throw new Error("endDate phải sau startDate");
    }

    // ----- sinh code duy nhất (6 ký tự in hoa + số, có thể thêm prefix) -----
    const normalizedPrefix = codePrefix ? `${codePrefix.trim().toUpperCase()}-` : "";
    const codes = await generateUniqueCodes(quantity, normalizedPrefix, codeLength);

    // ----- build danh sách document -----
    const pad = String(quantity).length;
    const docs = codes.map((code, index) => ({
        name: `${namePrefix} #${String(index + 1).padStart(pad, "0")}`,
        code,
        description,
        discountType,
        discountValue,
        maxDiscountAmount,
        minOrderValue,
        applicableChannels,
        applicableCategoryIds,
        applicableFoodIds,
        // Để trống -> bất kỳ khách nào cũng đủ điều kiện dùng; vì usageLimit=1
        // nên hễ có 1 người dùng là voucher tự động hết hiệu lực (EXPIRED).
        applicableCustomerIds: [],
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        usageLimit: 1, // mỗi voucher chỉ dùng được 1 lần duy nhất trên toàn hệ thống
        usageLimitPerCustomer: 1,
        usedCount: 0,
        isActive: true,
    }));

    // ----- insert (ordered:false để 1 lỗi trùng key hiếm gặp không chặn cả batch) -----
    try {
        return await Voucher.insertMany(docs, { ordered: false });
    } catch (err) {
        if (err.insertedDocs && err.insertedDocs.length > 0) {
            return err.insertedDocs;
        }
        throw err;
    }
}

class VoucherController {

    async createVoucher(req, res) {
        try {
            const {
                name,
                code,
                description = "",
                discountType,
                discountValue,
                maxDiscountAmount = null,
                minOrderValue = 0,
                applicableChannels = [],
                applicableCategoryIds = [],
                applicableFoodIds = [],
                applicableCustomerIds = [],
                startDate,
                endDate,
                usageLimit = null,
                usageLimitPerCustomer = 1,
                isActive = true,
            } = req.body;

            if (!name || !name.trim()) {
                return res.status(400).json({ message: "name is required" });
            }

            if (!code || !code.trim()) {
                return res.status(400).json({ message: "code is required" });
            }

            const VALID_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"];
            if (!VALID_DISCOUNT_TYPES.includes(discountType)) {
                return res.status(400).json({
                    message: `discountType must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`
                });
            }

            if (typeof discountValue !== "number" || discountValue < 0) {
                return res.status(400).json({ message: "discountValue must be >= 0" });
            }

            if (discountType === "PERCENTAGE" && discountValue > 100) {
                return res.status(400).json({ message: "discountValue (PERCENTAGE) must be <= 100" });
            }

            if (!endDate) {
                return res.status(400).json({ message: "endDate is required" });
            }

            const voucher = await Voucher.create({
                name: name.trim(),
                code: code.trim().toUpperCase(),
                description,
                discountType,
                discountValue,
                maxDiscountAmount,
                minOrderValue,
                applicableChannels,
                applicableCategoryIds,
                applicableFoodIds,
                applicableCustomerIds,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: new Date(endDate),
                usageLimit,
                usageLimitPerCustomer,
                isActive,
            });

            return res.status(201).json({ message: "Voucher created successfully", voucher });

        } catch (error) {
            console.error("Error creating voucher:", error);

            if (error.code === 11000) {
                return res.status(409).json({ message: "Voucher code already exists" });
            }
            if (error.name === "ValidationError") {
                return res.status(400).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message || "Internal server error" });
        }
    }

    async getVouchers(req, res) {
        try {
            const { isActive, search } = req.query;
            const filter = {};

            if (isActive !== undefined) filter.isActive = isActive === "true";
            if (search) filter.code = { $regex: search.trim(), $options: "i" };

            const vouchers = await Voucher.find(filter).sort({ createdAt: -1 });
            return res.json(vouchers);

        } catch (error) {
            console.error("Error fetching vouchers:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async getVoucherStats(req, res) {
        try {
            const { range } = req.query;
            const now = new Date();
            let dateFilter = {};

            if (range === "today") {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                dateFilter = { createdAt: { $gte: start } };
            } else if (range === "7d") {
                dateFilter = { createdAt: { $gte: new Date(now - 7 * 86400000) } };
            } else if (range === "30d") {
                dateFilter = { createdAt: { $gte: new Date(now - 30 * 86400000) } };
            }

            const [totalVouchers, allVouchers, redemptionStats] = await Promise.all([
                Voucher.countDocuments(),
                Voucher.find({}, { isActive: 1, startDate: 1, endDate: 1, usageLimit: 1, usedCount: 1 }),
                VoucherRedemption.aggregate([
                    { $match: { released: false, ...dateFilter } },
                    { $group: { _id: null, totalDiscount: { $sum: "$discountApplied" }, totalUses: { $sum: 1 } } },
                ]),
            ]);

            let active = 0, expiringSoon = 0, expired = 0;

            allVouchers.forEach((v) => {
                const isExpired =
                    !v.isActive ||
                    now > v.endDate ||
                    (v.usageLimit !== null && v.usedCount >= v.usageLimit);

                if (isExpired) {
                    expired++;
                } else if ((v.endDate - now) / 86400000 <= 3) {
                    expiringSoon++;
                } else {
                    active++;
                }
            });

            return res.json({
                success: true,
                data: {
                    totalVouchers,
                    active,
                    expiringSoon,
                    expired,
                    totalDiscountAmount: redemptionStats[0]?.totalDiscount || 0,
                    totalUses: redemptionStats[0]?.totalUses || 0,
                },
            });

        } catch (error) {
            console.error("Error fetching voucher stats:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async getVoucherById(req, res) {
        try {
            const voucher = await Voucher.findById(req.params.id);
            if (!voucher) return res.status(404).json({ message: "Voucher not found" });
            return res.json(voucher);

        } catch (error) {
            console.error("Error fetching voucher:", error);
            if (error.name === "CastError") return res.status(400).json({ message: "Invalid voucher id" });
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async updateVoucher(req, res) {
        try {
            const { id } = req.params;
            const updates = { ...req.body };

            // usedCount CHỈ được thay đổi qua redeemVoucher/rollbackVoucherClaim
            // (đảm bảo tính nguyên tử) — không cho sửa trực tiếp qua API này.
            delete updates.usedCount;

            if (updates.code) updates.code = updates.code.trim().toUpperCase();
            if (updates.name) updates.name = updates.name.trim();
            if (updates.startDate) updates.startDate = new Date(updates.startDate);
            if (updates.endDate) updates.endDate = new Date(updates.endDate);

            const voucher = await Voucher.findByIdAndUpdate(id, updates, {
                new: true,
                runValidators: true,
            });

            if (!voucher) return res.status(404).json({ message: "Voucher not found" });

            return res.json({ message: "Voucher updated successfully", voucher });

        } catch (error) {
            console.error("Error updating voucher:", error);

            if (error.code === 11000) return res.status(409).json({ message: "Voucher code already exists" });
            if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
            if (error.name === "CastError") return res.status(400).json({ message: "Invalid voucher id" });

            return res.status(500).json({ message: error.message || "Internal server error" });
        }
    }

    async deleteVoucher(req, res) {
        try {
            const { id } = req.params;

            const hasRedemptions = await VoucherRedemption.exists({ voucherId: id });

            if (hasRedemptions) {
                const voucher = await Voucher.findByIdAndUpdate(id, { isActive: false }, { new: true });
                if (!voucher) return res.status(404).json({ message: "Voucher not found" });

                return res.json({
                    message: "Voucher đã từng được sử dụng nên chỉ bị vô hiệu hoá (isActive=false), không xoá cứng",
                    voucher
                });
            }

            const voucher = await Voucher.findByIdAndDelete(id);
            if (!voucher) return res.status(404).json({ message: "Voucher not found" });

            return res.json({ message: "Voucher deleted successfully" });

        } catch (error) {
            console.error("Error deleting voucher:", error);
            if (error.name === "CastError") return res.status(400).json({ message: "Invalid voucher id" });
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async validateVoucher(req, res) {
        try {
            const { code, channel = "ONLINE", items = [], subtotal, customerKey = null } = req.body;

            if (!code) return res.status(400).json({ message: "code is required" });
            if (typeof subtotal !== "number" || subtotal < 0) {
                return res.status(400).json({ message: "subtotal is required and must be >= 0" });
            }

            const voucher = await Voucher.findOne({ code: String(code).toUpperCase().trim() });
            if (!voucher) return res.status(404).json({ message: "Voucher không tồn tại" });

            if (customerKey && voucher.usageLimitPerCustomer !== null) {
                const usedByCustomer = await VoucherRedemption.countDocuments({
                    voucherId: voucher._id,
                    customerKey,
                    released: false,
                });
                if (usedByCustomer >= voucher.usageLimitPerCustomer) {
                    return res.status(400).json({ message: "Bạn đã dùng hết lượt cho voucher này" });
                }
            }

            const discountAmount = await computeVoucherDiscount(voucher, { channel, items, subtotal, customerKey });

            return res.status(200).json({
                success: true,
                data: {
                    code: voucher.code,
                    discountType: voucher.discountType,
                    discountValue: voucher.discountValue,
                    discountAmount,
                    finalTotal: Math.max(0, subtotal - discountAmount),
                }
            });

        } catch (error) {
            console.error("Error validating voucher:", error);

            if (error instanceof VoucherError) {
                return res.status(400).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message || "Internal server error" });
        }
    }

    async createVoucherBatch(req, res) {
        try {
            const vouchers = await buildVoucherBatch(req.body);
            return res.status(201).json({
                success: true,
                message: `Đã tạo ${vouchers.length} voucher dùng 1 lần`,
                data: vouchers,
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || "Tạo voucher hàng loạt thất bại",
            });
        }
    }
}

module.exports = new VoucherController();