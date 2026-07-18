// models/OrderModel.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderItemSchema = new Schema(
    {
        // Món ăn
        foodId: {
            type: Schema.Types.ObjectId,
            ref: 'Food',
            required: true
        },

        // Tên món tại thời điểm đặt
        // (tránh bị thay đổi tên sau này)
        foodName: {
            type: String,
            required: true
        },

        // Giá bán tại thời điểm đặt
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },

        // Số lượng
        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        // Tổng dòng
        total: {
            type: Number,
            required: true,
            min: 0
        },
        grossProfit: {
            type: Number,
            default: 0
        },
        costPriceSnapshot: {
            type: Number,
            required: true,
            min: 0
        },
        ingredientSnapshots:[]
    },
    { _id: false }
);

const orderSchema = new Schema(
    {
        // Danh sách món
        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: function (value) {
                    return value.length > 0;
                },
                message: 'Order must contain at least 1 item'
            }
        },

        // ❗ MỚI: liên kết đơn hàng với bàn (số bàn, không phải ObjectId của
        // Table — dùng chung định danh với socket.js để khỏi phải resolve
        // qua lại giữa _id và số bàn). Optional để không phá các Order cũ
        // (được tạo trước khi có khái niệm "bàn" trong hệ thống).
        tableNumber: {
            type: Number,
            default: null
        },

        // Tổng tiền trước giảm
        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        // Giảm giá đơn hàng
        discountAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        // Tổng thanh toán
        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        // Trạng thái đơn
        status: {
            type: String,
            enum: [
                'PENDING',
                'PROCESSING',
                'COMPLETED',
                'CANCELLED'
            ],
            default: 'PENDING'
        },

        // Phương thức thanh toán
        paymentMethod: {
            type: String,
            enum: [
                'CASH',
                'BANKING',
                'MOMO',
                'ZALOPAY'
            ],
            required: true
        },
        totalCost: {
            type: Number,
            default: 0,
            min: 0
        },

        // Tổng lợi nhuận gộp của đơn hàng
        // Formula: sum(item.grossProfit)  — tính trong pre-save
        totalGrossProfit: {
            type: Number,
            default: 0
        },

        // Đã thanh toán chưa
        isPaid: {
            type: Boolean,
            default: false
        },

        // Ghi chú
        note: {
            type: String,
            default: ''
        },

        // Người tạo đơn
        createdBy: {
            // type: Schema.Types.ObjectId,
            type: String,
            // ref: 'User'
        },


        // Thời gian hoàn tất
        completedAt: {
            type: Date
        },

        // Hủy lúc nào
        cancelledAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);


// =====================================================
// INDEX
// =====================================================

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentMethod: 1 });
orderSchema.index({ tableNumber: 1 }); // ❗ MỚI


// =====================================================
// PRE SAVE
// =====================================================

orderSchema.pre('save', function (next) {

    // Tính subtotal
    this.subtotal = this.items.reduce(
        (sum, item) => sum + item.total,
        0
    );

    // Tổng lợi nhuận
    this.totalGrossProfit = this.items.reduce(
        (sum, item) => sum + item.grossProfit,
        0
    );

    // Tổng thanh toán
    this.totalAmount =
        this.subtotal - this.discountAmount;

    if (this.totalAmount < 0) {
        this.totalAmount = 0;
    }

    this.totalCost = this.items.reduce(
        (sum, item) =>
            sum + (
                item.costPriceSnapshot *
                item.quantity
            ),
        0
    );

    next();
});


module.exports = mongoose.model(
    'Order',
    orderSchema
);