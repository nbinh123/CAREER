const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ingredientTransactionSchema = new Schema(
    {
        ingredientId: {
            type: Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true
        },
        type: {
            type: String,
            enum: ['IMPORT', 'EXPORT'],
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        stockBefore: {
            type: Number,
            required: true,
            min: 0
        },
        stockAfter: {
            type: Number,
            required: true,
            min: 0
        },
        amount: {
            type: Number,
            default: 0,
            min: 0
        },
        invoiceImage: {
            type: String,
            default: ''
        },
        note: {
            type: String,
            default: '',
            trim: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('IngredientTransaction', ingredientTransactionSchema);