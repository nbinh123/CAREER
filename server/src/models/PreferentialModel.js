// models/PreferentialModel.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const preferentialSchema = new Schema(
    {
        // Mã loại món
        code: {
            type: String,
            unique: true,
            enum: ['DC', 'LL', 'TBK', 'DS', 'NT', 'MC', 'CD'],
            uppercase: true,
            trim: true
        },

        // Tên loại món
        categoryName: {
            type: String,
            trim: true
        },

        // Ưu đãi %
        percentageDiscount: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },

        // Ưu đãi tiền mặt
        fixedDiscount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    'Preferential',
    preferentialSchema
);