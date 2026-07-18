// models/IngredientModel.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ingredientSchema = new Schema(
    {
        stockQuantity: {
            type: Number,
            default: 0
        },
        // STT (thứ tự hiển thị)
        displayOrder: {
            type: Number,
            default: 0,
            min: 0
        },

        // Tên nguyên liệu
        ingredientName: {
            type: String,
            required: [true, 'Ingredient name is required'],
            trim: true
        },

        // Số lượng hiện có
        quantity: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        // Đơn vị nhỏ
        smallUnit: {
            type: String,
            required: true,
            trim: true
        },

        // Đơn vị lớn
        largeUnit: {
            type: String,
            required: true,
            trim: true
        },

        // Giá / đơn vị lớn
        pricePerLargeUnit: {
            type: Number,
            required: true,
            min: 0
        },

        // Hạn sử dụng (ngày)
        expiryDays: {
            type: Number,
            required: true,
            min: 0
        },

        // Ghi chú
        note: {
            type: String,
            default: '',
            trim: true
        },

        // Có cần bổ sung liên tục không
        needContinuousRestock: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    'Ingredient',
    ingredientSchema
);