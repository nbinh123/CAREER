// models/FoodModel.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// =====================================================
// INGREDIENT SCHEMA
// =====================================================

const ingredientSchema = new Schema(
    {
        ingredientId: {
            type: Schema.Types.ObjectId,
            ref: "Ingredient",
            required: true,
        },

        ingredientName: {
            type: String,
            required: true,
            trim: true,
        },

        quantity: {
            type: Number,
            required: true,
            min: 0,
        },

        unit: {
            type: String,
            required: true,
            trim: true,
        },

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
        foodName: {
            type: String,
            required: [true, "Food name is required"],
            trim: true,
        },

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

        ingredients: {
            type: [ingredientSchema],
            default: [],
        },

        costPrice: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        originalPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        aiTrainingWeight: {
            type: Number,
            min: 0,
            max: 1,
            default: 0,
        },

        isAvailable: {
            type: Boolean,
            default: true,
        },

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

        emoji: {
            type: String,
            default: "",
            trim: true,
        },

        // Ảnh món ăn (hiển thị ở trang Order phía khách - MenuItemCard.jsx /
        // MenuItemDetailModal.jsx đang đọc item.imageUrl qua FoodThumbnail).
        // Từ khi chuyển sang Cloudinary, đây là secure_url do Cloudinary trả về.
        imageUrl: {
            type: String,
            default: "",
            trim: true,
        },

        // ❗ MỚI — public_id Cloudinary tương ứng với imageUrl ở trên. Cần
        // lưu riêng để FoodController.updateFood/deleteFood xoá đúng ảnh cũ
        // trên Cloudinary (cloudinary.uploader.destroy(imagePublicId)) mỗi
        // khi đổi ảnh mới hoặc xoá món, tránh rác ảnh không dùng tới.
        imagePublicId: {
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

foodSchema.virtual("grossProfit").get(function () {
    return this.originalPrice - this.costPrice;
});

foodSchema.virtual("profitMargin").get(function () {
    if (this.originalPrice <= 0) {
        return 0;
    }

    return this.grossProfit / this.originalPrice;
});

foodSchema.virtual("aiScore").get(function () {
    return this.profitMargin * this.aiTrainingWeight;
});

foodSchema.virtual("costRatio").get(function () {
    if (this.originalPrice <= 0) {
        return 0;
    }

    return this.costPrice / this.originalPrice;
});

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