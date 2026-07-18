// models/FoodModel.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// =====================================================
// INGREDIENT SCHEMA
// =====================================================

const ingredientSchema = new Schema(
    {
        // Tham chiếu nguyên liệu
        ingredientId: {
            type: Schema.Types.ObjectId,
            ref: "Ingredient",
            required: true,
        },

        // Tên nguyên liệu tại thời điểm tạo món
        ingredientName: {
            type: String,
            required: true,
            trim: true,
        },

        // Số lượng sử dụng
        quantity: {
            type: Number,
            required: true,
            min: 0,
        },

        // Đơn vị
        unit: {
            type: String,
            required: true,
            trim: true,
        },

        // Chi phí nguyên liệu này
        cost: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    {
        _id: false,
    }
);

// =====================================================
// FOOD SCHEMA
// =====================================================

const foodSchema = new Schema(
    {
        // Tên món
        foodName: {
            type: String,
            required: [true, "Food name is required"],
            trim: true,
        },

        // Mô tả món ăn
        description: {
            type: String,
            default: "",
            trim: true,
        },

        categoryId: {
            type: String,
            required: true,
            trim: true,
        },

        // Danh sách nguyên liệu
        ingredients: {
            type: [ingredientSchema],
            default: [],
        },

        // Giá vốn
        costPrice: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        // Giá bán
        originalPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        // Trọng số AI
        // Dùng để train recommendation
        // Giá trị từ 0 -> 1
        aiTrainingWeight: {
            type: Number,
            min: 0,
            max: 1,
            default: 0,
        },

        // Có đang bán không
        isAvailable: {
            type: Boolean,
            default: true,
        },

        // Số lượng đã bán
        soldCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        note: {
            type: String,
            default: "",
            trim: true,
        },

        // Emoji đại diện cho món (hiển thị ở trang Order/Bếp phía admin -
        // OrdersPage.jsx và KitchenPage.jsx đang đọc item.emoji, và
        // initSocket.js (send_to_kitchen) đã forward field này từ Food
        // sang pendingItems/items sẵn - trước đây schema chưa có field này
        // nên luôn rơi về "").
        emoji: {
            type: String,
            default: "",
            trim: true,
        },

        // Ảnh món ăn (hiển thị ở trang Order phía khách - MenuItemCard.jsx /
        // MenuItemDetailModal.jsx đang đọc item.imageUrl qua FoodThumbnail;
        // trước đây schema chưa có field này nên luôn rơi về icon fallback).
        imageUrl: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,

        toJSON: {
            virtuals: true,
        },

        toObject: {
            virtuals: true,
        },
    }
);

// =====================================================
// VIRTUAL FIELDS
// =====================================================

// LỢI NHUẬN GỘP
// Formula:
// originalPrice - costPrice

foodSchema.virtual("grossProfit").get(function () {
    return this.originalPrice - this.costPrice;
});

// =====================================================

// BIÊN LỢI NHUẬN
// Formula:
// grossProfit / originalPrice

foodSchema.virtual("profitMargin").get(function () {
    if (this.originalPrice <= 0) {
        return 0;
    }

    return this.grossProfit / this.originalPrice;
});

// =====================================================

// ĐIỂM AI
// Formula:
// profitMargin * aiTrainingWeight

foodSchema.virtual("aiScore").get(function () {
    return this.profitMargin * this.aiTrainingWeight;
});

// =====================================================

// TỶ LỆ COST
// Formula:
// costPrice / originalPrice

foodSchema.virtual("costRatio").get(function () {
    if (this.originalPrice <= 0) {
        return 0;
    }

    return this.costPrice / this.originalPrice;
});

// =====================================================

// TRẠNG THÁI LỢI NHUẬN

foodSchema.virtual("profitStatus").get(function () {
    const margin = this.profitMargin;

    if (margin >= 0.6) {
        return "EXCELLENT";
    }

    if (margin >= 0.4) {
        return "GOOD";
    }

    if (margin >= 0.2) {
        return "NORMAL";
    }

    return "LOW";
});

// =====================================================
// STATIC METHODS
// =====================================================

// Tổng trọng số AI toàn menu

foodSchema.statics.getTotalAIWeight =
    async function () {
        const result = await this.aggregate([
            {
                $group: {
                    _id: null,
                    totalWeight: {
                        $sum: "$aiTrainingWeight",
                    },
                },
            },
        ]);

        return result[0]?.totalWeight || 0;
    };

// =====================================================

// Tổng số lượng bán

foodSchema.statics.getTotalSoldCount =
    async function () {
        const result = await this.aggregate([
            {
                $group: {
                    _id: null,
                    totalSold: {
                        $sum: "$soldCount",
                    },
                },
            },
        ]);

        return result[0]?.totalSold || 0;
    };

// =====================================================
// INSTANCE METHODS
// =====================================================

// Trọng số AI tương đối

foodSchema.methods.getRelativeWeight =
    async function () {
        const Food = this.constructor;

        const totalWeight =
            await Food.getTotalAIWeight();

        if (totalWeight <= 0) {
            return 0;
        }

        return (
            this.aiTrainingWeight /
            totalWeight
        );
    };

// =====================================================

// Tỷ lệ bán tương đối

foodSchema.methods.getRelativeSoldScore =
    async function () {
        const Food = this.constructor;

        const totalSold =
            await Food.getTotalSoldCount();

        if (totalSold <= 0) {
            return 0;
        }

        return this.soldCount / totalSold;
    };

// =====================================================

// Điểm ranking tổng hợp AI

foodSchema.methods.getFinalAIScore =
    async function () {
        const relativeWeight =
            await this.getRelativeWeight();

        const relativeSold =
            await this.getRelativeSoldScore();

        return (
            this.aiScore * 0.6 +
            relativeWeight * 0.2 +
            relativeSold * 0.2
        );
    };

// =====================================================
// INDEXES
// =====================================================

foodSchema.index({
    foodName: "text",
});

foodSchema.index({
    categoryId: 1,
});

foodSchema.index({
    isAvailable: 1,
});

foodSchema.index({
    soldCount: -1,
});

foodSchema.index({
    aiTrainingWeight: -1,
});

// =====================================================

module.exports = mongoose.model(
    "Food",
    foodSchema
);