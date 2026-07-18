// models/AnalystModel.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// =====================================================
// HOURLY TRAFFIC SCHEMA
// Lưu lượng khách + doanh thu theo từng giờ trong ngày
// =====================================================

const hourlyTrafficSchema = new Schema(
    {
        hour: {
            type: Number,
            required: true,
            min: 0,
            max: 23
        },
        billCount: {
            type: Number,
            default: 0,
            min: 0
        },
        revenue: {
            type: Number,
            default: 0,
            min: 0
        },
        avgBillValue: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { _id: false }
);

// =====================================================
// FOOD SALE SCHEMA
// Lưu doanh số từng món trong ngày
// =====================================================

const foodSaleSchema = new Schema(
    {
        foodId: {
            type: Schema.Types.ObjectId,
            ref: 'Food',
            required: true
        },
        foodName: {
            type: String,
            required: true,
            trim: true
        },
        categoryId: {
            type: String,
            default: ''
        },
        quantitySold: {
            type: Number,
            default: 0,
            min: 0
        },
        revenue: {
            type: Number,
            default: 0,
            min: 0
        },
        cost: {
            type: Number,
            default: 0,
            min: 0
        },
        grossProfit: {
            type: Number,
            default: 0
        }
    },
    { _id: false }
);

// =====================================================
// INGREDIENT USAGE SCHEMA
// Lưu lượng nguyên liệu tiêu thụ trong ngày
// =====================================================

const ingredientUsageSchema = new Schema(
    {
        ingredientId: {
            type: Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true
        },
        ingredientName: {
            type: String,
            required: true,
            trim: true
        },
        smallUnit: {
            type: String,
            default: ''
        },
        largeUnit: {
            type: String,
            default: ''
        },
        quantityUsed: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { _id: false }
);

// =====================================================
// DAILY SNAPSHOT SCHEMA
// Snapshot phân tích cho 1 ngày cụ thể
// Được tạo/cập nhật tự động bởi snapshotService
// =====================================================

const dailySnapshotSchema = new Schema(
    {
        // Ngày (normalize về 00:00:00 UTC)
        date: {
            type: Date,
            required: true,
            unique: true
        },

        // ---- DOANH THU & CHI PHÍ ----
        revenue: {
            type: Number,
            default: 0,
            min: 0
        },
        cost: {
            type: Number,
            default: 0,
            min: 0
        },
        grossProfit: {
            type: Number,
            default: 0
        },
        discountAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        // ---- BILL ----
        billCount: {
            type: Number,
            default: 0,
            min: 0
        },
        avgBillValue: {
            type: Number,
            default: 0,
            min: 0
        },

        // ---- TRAFFIC THEO GIỜ ----
        hourlyTraffic: {
            type: [hourlyTrafficSchema],
            default: []
        },

        // ---- DOANH SỐ THEO MÓN ----
        foodSales: {
            type: [foodSaleSchema],
            default: []
        },

        // ---- TIÊU THỤ NGUYÊN LIỆU ----
        ingredientUsage: {
            type: [ingredientUsageSchema],
            default: []
        },

        // Đã được tổng hợp từ orders hay chưa
        isFinalized: {
            type: Boolean,
            default: false
        },

        // Thời điểm snapshot được tính/cập nhật gần nhất
        lastComputedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// =====================================================
// INDEXES
// =====================================================

dailySnapshotSchema.index({ date: -1 });
dailySnapshotSchema.index({ date: 1, isFinalized: 1 });

// =====================================================
// PID STATE SCHEMA
// Lưu trạng thái PID Controller cho từng nguyên liệu
// Để dự đoán lượng cần chuẩn bị cho chu kỳ tiếp theo
//
// Công thức PID:
//   error[t]   = actual[t] - setpoint
//   P          = Kp * error[t]
//   I          = Ki * sum(error[0..t])
//   D          = Kd * (error[t] - error[t-1])
//   output[t]  = setpoint + P + I + D
// =====================================================

const pidStateSchema = new Schema(
    {
        ingredientId: {
            type: Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true,
            unique: true
        },
        ingredientName: {
            type: String,
            required: true,
            trim: true
        },
        smallUnit: {
            type: String,
            default: ''
        },

        // Đơn vị lớn (kg, lít, …)
        // Controller dùng: ing.smallUnit || ing.largeUnit
        largeUnit: {
            type: String,
            default: ''
        },

        // Setpoint = mức tiêu thụ kỳ vọng (trung bình lịch sử)
        setpoint: {
            type: Number,
            default: 0,
            min: 0
        },

        // Tham số PID
        Kp: {
            type: Number,
            default: 0.6
        },
        Ki: {
            type: Number,
            default: 0.1
        },
        Kd: {
            type: Number,
            default: 0.05
        },

        // Trạng thái tích lũy
        integralError: {
            type: Number,
            default: 0
        },
        lastError: {
            type: Number,
            default: 0
        },

        // Lịch sử tiêu thụ (N chu kỳ gần nhất, dùng để tính setpoint)
        usageHistory: {
            type: [Number],
            default: []
        },

        // Lần cập nhật cuối
        lastUpdatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

pidStateSchema.index({ ingredientId: 1 });

// =====================================================
// EXPORTS
// =====================================================

const DailySnapshot = mongoose.model(
    'DailySnapshot',
    dailySnapshotSchema
);

const PIDState = mongoose.model(
    'PIDState',
    pidStateSchema
);

module.exports = { DailySnapshot, PIDState };