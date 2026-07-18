// services/analystService.js
//
// Chứa toàn bộ logic tính toán phân tích.
// Controller chỉ gọi service, KHÔNG tính toán trực tiếp.

const mongoose = require('mongoose');
const Order = require('../../models/OrderModel');
const Food = require('../../models/FoodModel');
const Ingredient = require('../../models/IngredientModel');
const { DailySnapshot, PIDState } = require('../../models/AnalystModel');

// =====================================================
// HELPER: DATE UTILITIES
// =====================================================

/**
 * Normalize 1 Date về 00:00:00.000 UTC của ngày đó
 */
function startOfDay(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Trả về ngày cuối của ngày (23:59:59.999 UTC)
 */
function endOfDay(date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

/**
 * Tạo mảng các ngày từ start đến end (inclusive)
 */
function generateDateRange(start, end) {
    const dates = [];
    const cur = startOfDay(start);
    const last = startOfDay(end);
    while (cur <= last) {
        dates.push(new Date(cur));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
}

/**
 * Lấy ngày đầu tuần (thứ 2) của một ngày
 */
function startOfWeek(date) {
    const d = startOfDay(date);
    const day = d.getUTCDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
}

/**
 * Lấy ngày đầu tháng
 */
function startOfMonth(date) {
    const d = new Date(date);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Format label cho từng granularity
 */
function formatLabel(date, granularity) {
    const d = new Date(date);
    if (granularity === 'day') {
        return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    if (granularity === 'week') {
        // ISO week: YYYY-Www
        const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(
            ((d - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7
        );
        return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }
    if (granularity === 'month') {
        return d.toISOString().slice(0, 7); // YYYY-MM
    }
    return d.toISOString().slice(0, 10);
}

// =====================================================
// MATH: EMA & MA
// =====================================================

/**
 * Tính Exponential Moving Average
 * @param {number[]} values  - Mảng giá trị theo thứ tự thời gian
 * @param {number}   period  - Chu kỳ EMA (mặc định 7)
 * @returns {(number|null)[]} - Mảng EMA cùng độ dài (null nếu chưa đủ data)
 */
function computeEMA(values, period = 7) {
    const k = 2 / (period + 1);
    const result = new Array(values.length).fill(null);

    let ema = null;
    for (let i = 0; i < values.length; i++) {
        if (values[i] == null) continue;
        if (ema === null) {
            ema = values[i];
        } else {
            ema = values[i] * k + ema * (1 - k);
        }
        result[i] = Math.round(ema * 100) / 100;
    }
    return result;
}

/**
 * Tính Simple Moving Average
 * @param {number[]} values
 * @param {number}   window  - Cửa sổ MA
 * @returns {(number|null)[]}
 */
function computeMA(values, window = 7) {
    const result = new Array(values.length).fill(null);
    for (let i = 0; i < values.length; i++) {
        if (i < window - 1) continue;
        const slice = values.slice(i - window + 1, i + 1).filter(v => v != null);
        if (slice.length === 0) continue;
        result[i] = Math.round(
            (slice.reduce((a, b) => a + b, 0) / slice.length) * 100
        ) / 100;
    }
    return result;
}

/**
 * Tự động xác định granularity dựa theo khoảng ngày
 * @returns {'day'|'week'|'month'}
 */
function autoGranularity(from, to) {
    const diffDays =
        (startOfDay(to) - startOfDay(from)) / 86400000 + 1;
    if (diffDays <= 35) return 'day';
    if (diffDays <= 180) return 'week';
    return 'month';
}

// =====================================================
// MATH: PID CONTROLLER
// =====================================================

/**
 * Tính output PID cho 1 nguyên liệu
 * @param {number[]} history     - Lịch sử tiêu thụ (các chu kỳ trước)
 * @param {number}   setpoint    - Mức tiêu thụ kỳ vọng
 * @param {object}   state       - { integralError, lastError }
 * @param {object}   gains       - { Kp, Ki, Kd }
 * @returns {{ output, integralError, lastError }}
 */
function computePIDOutput(history, setpoint, state, gains) {
    const { Kp = 0.6, Ki = 0.1, Kd = 0.05 } = gains;
    const actual = history.length > 0
        ? history[history.length - 1]
        : setpoint;

    const error = actual - setpoint;
    const integral = state.integralError + error;
    const derivative = error - state.lastError;

    const pidCorrection = Kp * error + Ki * integral + Kd * derivative;

    // Output = setpoint + correction (không âm)
    const output = Math.max(0, setpoint + pidCorrection);

    return {
        output: Math.round(output * 100) / 100,
        integralError: integral,
        lastError: error
    };
}

/**
 * Tính setpoint = trung bình lịch sử (loại bỏ outlier bằng IQR)
 */
function computeSetpoint(history) {
    if (history.length === 0) return 0;
    if (history.length <= 2) {
        return history.reduce((a, b) => a + b, 0) / history.length;
    }
    const sorted = [...history].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const filtered = sorted.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

// =====================================================
// SNAPSHOT SERVICE
// Tổng hợp dữ liệu từ Order → DailySnapshot
// Gọi mỗi ngày (cron job) hoặc on-demand
// =====================================================

/**
 * Build (hoặc rebuild) DailySnapshot cho một ngày cụ thể
 * @param {Date|string} date
 * @returns {Promise<DailySnapshot>}
 */
async function buildDailySnapshot(date) {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Lấy tất cả đơn COMPLETED trong ngày
    const orders = await Order.find({
        status: 'COMPLETED',
        createdAt: { $gte: dayStart, $lte: dayEnd }
    }).lean();

    // ---- Tổng hợp ----
    let revenue = 0;
    let cost = 0;
    let grossProfit = 0;
    let discountAmount = 0;
    const billCount = orders.length;

    // hourlyTraffic: hour → { billCount, revenue }
    const hourMap = {};
    for (let h = 0; h < 24; h++) {
        hourMap[h] = { hour: h, billCount: 0, revenue: 0 };
    }

    // foodSales: foodId → aggregated
    const foodMap = {};

    // ingredientUsage: ingredientId → aggregated
    const ingredientMap = {};

    for (const order of orders) {
        revenue += order.totalAmount || 0;
        cost += order.totalCost || 0;
        grossProfit += (order.totalAmount || 0) - (order.totalCost || 0);
        discountAmount += order.discountAmount || 0;

        // Giờ tạo đơn
        const hour = new Date(order.createdAt).getUTCHours();
        hourMap[hour].billCount += 1;
        hourMap[hour].revenue += order.totalAmount || 0;

        // Tổng hợp theo món
        for (const item of order.items || []) {
            const key = String(item.foodId);
            if (!foodMap[key]) {
                foodMap[key] = {
                    foodId: item.foodId,
                    foodName: item.foodName,
                    categoryId: '',
                    quantitySold: 0,
                    revenue: 0,
                    cost: 0,
                    grossProfit: 0
                };
            }
            foodMap[key].quantitySold += item.quantity || 0;
            foodMap[key].revenue += item.total || 0;
            foodMap[key].grossProfit += item.grossProfit || 0;
        }
    }

    // Tính avgBillValue
    const avgBillValue = billCount > 0
        ? Math.round((revenue / billCount) * 100) / 100
        : 0;

    // Tính avgBillValue theo giờ
    const hourlyTraffic = Object.values(hourMap).map(h => ({
        ...h,
        avgBillValue: h.billCount > 0
            ? Math.round((h.revenue / h.billCount) * 100) / 100
            : 0
    }));

    // Lấy thông tin nguyên liệu từ Food
    // (join Food để lấy ingredients của từng món đã bán)
    const foodIds = Object.keys(foodMap).map(id => new mongoose.Types.ObjectId(id));
    const foods = await Food.find({ _id: { $in: foodIds } }).lean();

    const foodDetailMap = {};
    for (const f of foods) {
        foodDetailMap[String(f._id)] = f;
        // Gán categoryId vào foodMap
        if (foodMap[String(f._id)]) {
            foodMap[String(f._id)].categoryId = f.categoryId || '';
        }
    }

    // Tính ingredient usage từ food recipes
    for (const [foodId, sale] of Object.entries(foodMap)) {
        const food = foodDetailMap[foodId];
        if (!food || !food.ingredients) continue;

        for (const ing of food.ingredients) {
            const key = String(ing.ingredientId);
            if (!ingredientMap[key]) {
                ingredientMap[key] = {
                    ingredientId: ing.ingredientId,
                    ingredientName: ing.ingredientName,
                    smallUnit: ing.unit || '',
                    largeUnit: '',
                    quantityUsed: 0
                };
            }
            ingredientMap[key].quantityUsed +=
                (ing.quantity || 0) * sale.quantitySold;
        }

        // Tính cost của food sale
        const food_ = foodDetailMap[foodId];
        if (food_) {
            foodMap[foodId].cost =
                (food_.costPrice || 0) * sale.quantitySold;
        }
    }

    // Lấy thêm largeUnit từ IngredientModel
    const ingIds = Object.keys(ingredientMap).map(
        id => new mongoose.Types.ObjectId(id)
    );
    if (ingIds.length > 0) {
        const Ingredient = require('../models/IngredientModel');
        const ingredientDocs = await Ingredient.find(
            { _id: { $in: ingIds } },
            { largeUnit: 1, smallUnit: 1 }
        ).lean();
        for (const doc of ingredientDocs) {
            const key = String(doc._id);
            if (ingredientMap[key]) {
                ingredientMap[key].largeUnit = doc.largeUnit || '';
                if (!ingredientMap[key].smallUnit) {
                    ingredientMap[key].smallUnit = doc.smallUnit || '';
                }
            }
        }
    }

    // Upsert DailySnapshot
    const snapshot = await DailySnapshot.findOneAndUpdate(
        { date: dayStart },
        {
            $set: {
                date: dayStart,
                revenue: Math.round(revenue * 100) / 100,
                cost: Math.round(cost * 100) / 100,
                grossProfit: Math.round(grossProfit * 100) / 100,
                discountAmount: Math.round(discountAmount * 100) / 100,
                billCount,
                avgBillValue,
                hourlyTraffic,
                foodSales: Object.values(foodMap),
                ingredientUsage: Object.values(ingredientMap),
                isFinalized: startOfDay(new Date()) > dayStart,
                lastComputedAt: new Date()
            }
        },
        { upsert: true, new: true }
    );

    return snapshot;
}

/**
 * Rebuild snapshots cho một khoảng ngày
 */
async function buildSnapshotsForRange(from, to) {
    const dates = generateDateRange(from, to);
    const results = [];
    for (const d of dates) {
        const snap = await buildDailySnapshot(d);
        results.push(snap);
    }
    return results;
}

// =====================================================
// CHART 1: DOANH THU THEO NGÀY + EMA
// =====================================================

/**
 * @param {string} date    - Ngày kết thúc (YYYY-MM-DD)
 * @param {number} days    - Số ngày nhìn lại (mặc định 30)
 * @param {number} emaPeriod
 */
async function getRevenueDailyWithEMA(date, days = 30, emaPeriod = 7) {
    const end = startOfDay(date || new Date());
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);

    const snapshots = await DailySnapshot.find({
        date: { $gte: start, $lte: end }
    })
        .sort({ date: 1 })
        .lean();

    // Fill ngày thiếu với 0
    const dateMap = {};
    for (const s of snapshots) {
        dateMap[startOfDay(s.date).toISOString()] = s;
    }
    const allDates = generateDateRange(start, end);
    const labels = [];
    const revenueData = [];

    for (const d of allDates) {
        const key = d.toISOString();
        const snap = dateMap[key];
        labels.push(formatLabel(d, 'day'));
        revenueData.push(snap ? snap.revenue : 0);
    }

    const ema = computeEMA(revenueData, emaPeriod);

    return {
        labels,
        datasets: {
            revenue: revenueData,
            ema
        },
        meta: { emaPeriod, days }
    };
}

// =====================================================
// CHART 2: DOANH THU THEO TUẦN / THÁNG (CỘT)
// =====================================================

/**
 * @param {'week'|'month'} granularity
 * @param {number}         count  - Số tuần/tháng nhìn lại
 */
async function getRevenueByPeriod(granularity = 'week', count = 12) {
    // Tính khoảng thời gian
    const now = new Date();
    let start;
    if (granularity === 'week') {
        start = startOfWeek(now);
        start.setUTCDate(start.getUTCDate() - (count - 1) * 7);
    } else {
        start = startOfMonth(now);
        start.setUTCMonth(start.getUTCMonth() - (count - 1));
    }

    const snapshots = await DailySnapshot.find({
        date: { $gte: start, $lte: endOfDay(now) }
    })
        .sort({ date: 1 })
        .lean();

    // Nhóm theo granularity
    const grouped = {};
    for (const snap of snapshots) {
        let key;
        if (granularity === 'week') {
            key = formatLabel(startOfWeek(snap.date), 'week');
        } else {
            key = formatLabel(snap.date, 'month');
        }
        if (!grouped[key]) {
            grouped[key] = { revenue: 0, cost: 0, grossProfit: 0, billCount: 0 };
        }
        grouped[key].revenue += snap.revenue;
        grouped[key].cost += snap.cost;
        grouped[key].grossProfit += snap.grossProfit;
        grouped[key].billCount += snap.billCount;
    }

    const labels = Object.keys(grouped).sort();
    const revenueData = labels.map(k => Math.round(grouped[k].revenue * 100) / 100);

    return {
        labels,
        datasets: { revenue: revenueData },
        meta: { granularity, count }
    };
}

// =====================================================
// CHART 3: DOANH THU THEO KHOẢNG TÙY CHỌN + MA
// =====================================================

/**
 * @param {string} from        - YYYY-MM-DD
 * @param {string} to          - YYYY-MM-DD
 * @param {number} maPeriod    - Cửa sổ MA (mặc định tự động)
 */
async function getRevenueCustomRange(from, to, maPeriod) {
    const granularity = autoGranularity(from, to);

    const snapshots = await DailySnapshot.find({
        date: { $gte: startOfDay(from), $lte: endOfDay(to) }
    })
        .sort({ date: 1 })
        .lean();

    // Nhóm theo granularity tự động
    const grouped = {};
    for (const snap of snapshots) {
        let key;
        if (granularity === 'day') {
            key = formatLabel(snap.date, 'day');
        } else if (granularity === 'week') {
            key = formatLabel(startOfWeek(snap.date), 'week');
        } else {
            key = formatLabel(snap.date, 'month');
        }
        if (!grouped[key]) grouped[key] = 0;
        grouped[key] += snap.revenue;
    }

    const labels = Object.keys(grouped).sort();
    const revenueData = labels.map(k => Math.round(grouped[k] * 100) / 100);

    // Tự động chọn window MA
    const window = maPeriod || Math.max(3, Math.ceil(labels.length / 5));
    const ma = computeMA(revenueData, window);

    return {
        labels,
        datasets: { revenue: revenueData, ma },
        meta: { granularity, from, to, maPeriod: window }
    };
}

// =====================================================
// CHART 4: SỐ LƯỢNG BILL + EMA
// =====================================================

/**
 * @param {'day'|'week'|'month'} period
 * @param {number} count     - Số kỳ nhìn lại
 * @param {number} emaPeriod
 */
async function getBillCountWithEMA(period = 'day', count = 30, emaPeriod = 7) {
    const { labels, rawData } = await _aggregateMetric(
        period,
        count,
        snap => snap.billCount
    );
    const ema = computeEMA(rawData, emaPeriod);
    return {
        labels,
        datasets: { billCount: rawData, ema },
        meta: { period, count, emaPeriod }
    };
}

// =====================================================
// CHART 5: GIÁ TRỊ BILL TRUNG BÌNH + EMA
// =====================================================

/**
 * @param {'day'|'week'|'month'} period
 * @param {number} count
 * @param {number} emaPeriod
 */
async function getAvgBillValueWithEMA(period = 'day', count = 30, emaPeriod = 7) {
    // Tính avgBillValue cần cộng revenue + billCount theo kỳ rồi chia
    const { labels, grouped } = await _aggregateGrouped(period, count);
    const rawData = labels.map(k => {
        const g = grouped[k];
        return g.billCount > 0
            ? Math.round((g.revenue / g.billCount) * 100) / 100
            : 0;
    });
    const ema = computeEMA(rawData, emaPeriod);
    return {
        labels,
        datasets: { avgBillValue: rawData, ema },
        meta: { period, count, emaPeriod }
    };
}

// =====================================================
// CHART 6: DOANH THU + CHI PHÍ + LỢI NHUẬN
// =====================================================

/**
 * @param {'day'|'week'|'month'} period
 * @param {number} count
 */
async function getRevenueCostProfit(period = 'day', count = 30) {
    const { labels, grouped } = await _aggregateGrouped(period, count);
    const revenueData = labels.map(k =>
        Math.round((grouped[k].revenue || 0) * 100) / 100
    );
    const costData = labels.map(k =>
        Math.round((grouped[k].cost || 0) * 100) / 100
    );
    const profitData = labels.map(k =>
        Math.round((grouped[k].grossProfit || 0) * 100) / 100
    );
    return {
        labels,
        datasets: { revenue: revenueData, cost: costData, profit: profitData },
        meta: { period, count }
    };
}

// =====================================================
// CHART 7: LỢI NHUẬN TÍCH LŨY THEO THÁNG + BREAKEVEN
// =====================================================

/**
 * @param {number} year
 * @param {number} month       - 1-12
 * @param {number} breakeven   - Điểm hòa vốn (VND)
 */
async function getCumulativeProfitByMonth(year, month, breakeven = 0) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last day

    const snapshots = await DailySnapshot.find({
        date: { $gte: start, $lte: end }
    })
        .sort({ date: 1 })
        .lean();

    const snapMap = {};
    for (const s of snapshots) {
        const day = new Date(s.date).getUTCDate();
        snapMap[day] = s;
    }

    // Lấy số ngày trong tháng
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const labels = [];
    const cumulativeProfit = [];
    const segments = []; // [{ from, to, color }]

    let cumSum = 0;
    let crossedBreakeven = false;
    let crossingIdx = null;

    for (let d = 1; d <= daysInMonth; d++) {
        labels.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        const snap = snapMap[d];
        cumSum += snap ? snap.grossProfit : 0;
        cumulativeProfit.push(Math.round(cumSum * 100) / 100);

        if (!crossedBreakeven && cumSum >= breakeven) {
            crossedBreakeven = true;
            crossingIdx = d - 1;
        }
    }

    return {
        labels,
        datasets: {
            cumulativeProfit,
            breakeven: new Array(daysInMonth).fill(breakeven)
        },
        meta: {
            year,
            month,
            breakeven,
            // Index ngày vượt hòa vốn (null = chưa đạt)
            breakevenCrossIdx: crossingIdx,
            // Màu: dưới breakeven = red, trên = green
            colorRule: {
                below: '#ef4444',
                above: '#22c55e'
            }
        }
    };
}

// =====================================================
// CHART 8: TOP 5 MÓN ĂN BÁN CHẠY + CÁC MÓN KHÁC
// =====================================================

/**
 * @param {'day'|'week'} period
 * @param {string} date      - Ngày tham chiếu (YYYY-MM-DD), mặc định hôm nay
 * @param {'quantity'|'revenue'} sortBy
 */
async function getTopFoods(period = 'day', date, sortBy = 'quantity') {
    const ref = startOfDay(date || new Date());
    let start, end;

    if (period === 'day') {
        start = ref;
        end = endOfDay(ref);
    } else {
        start = startOfWeek(ref);
        end = endOfDay(new Date(start.getTime() + 6 * 86400000));
    }

    const snapshots = await DailySnapshot.find({
        date: { $gte: start, $lte: end }
    }).lean();

    // Gộp tất cả foodSales
    const foodMap = {};
    for (const snap of snapshots) {
        for (const fs of snap.foodSales || []) {
            const key = String(fs.foodId);
            if (!foodMap[key]) {
                foodMap[key] = {
                    foodId: fs.foodId,
                    foodName: fs.foodName,
                    quantitySold: 0,
                    revenue: 0,
                    grossProfit: 0
                };
            }
            foodMap[key].quantitySold += fs.quantitySold;
            foodMap[key].revenue += fs.revenue;
            foodMap[key].grossProfit += fs.grossProfit;
        }
    }

    const allFoods = Object.values(foodMap);
    const sorted = allFoods.sort((a, b) =>
        sortBy === 'revenue'
            ? b.revenue - a.revenue
            : b.quantitySold - a.quantitySold
    );

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);

    const othersTotal = {
        foodName: 'Các món khác',
        quantitySold: others.reduce((s, f) => s + f.quantitySold, 0),
        revenue: others.reduce((s, f) => s + f.revenue, 0),
        grossProfit: others.reduce((s, f) => s + f.grossProfit, 0)
    };

    const items = others.length > 0 ? [...top5, othersTotal] : top5;

    return {
        labels: items.map(f => f.foodName),
        datasets: {
            quantity: items.map(f => f.quantitySold),
            revenue: items.map(f => Math.round(f.revenue * 100) / 100)
        },
        meta: { period, date: ref.toISOString().slice(0, 10), sortBy }
    };
}

// =====================================================
// CHART 9: LƯỢT KHÁCH THEO GIỜ/NGÀY + BILL TRUNG BÌNH
// =====================================================

/**
 * Lượt khách theo giờ trong 1 ngày
 * @param {string} date
 */
async function getTrafficByHour(date) {
    const ref = startOfDay(date || new Date());
    const snap = await DailySnapshot.findOne({ date: ref }).lean();

    if (!snap) {
        const labels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
        return {
            labels,
            datasets: {
                billCount: new Array(24).fill(0),
                avgBillValue: new Array(24).fill(0)
            },
            meta: { date: ref.toISOString().slice(0, 10) }
        };
    }

    const hourly = snap.hourlyTraffic.sort((a, b) => a.hour - b.hour);
    const hourMap = {};
    for (const h of hourly) hourMap[h.hour] = h;

    const labels = [];
    const billCountData = [];
    const avgBillData = [];

    for (let h = 0; h < 24; h++) {
        labels.push(`${String(h).padStart(2, '0')}:00`);
        const entry = hourMap[h];
        billCountData.push(entry ? entry.billCount : 0);
        avgBillData.push(entry ? entry.avgBillValue : 0);
    }

    return {
        labels,
        datasets: { billCount: billCountData, avgBillValue: avgBillData },
        meta: { date: ref.toISOString().slice(0, 10) }
    };
}

/**
 * Lượt khách theo ngày (trên 1 tuần hoặc nhiều ngày) + bill trung bình
 * @param {'week'|'day'} period  - 'week' = xem 7 ngày gần nhất
 * @param {number} count         - Số ngày
 */
async function getTrafficByDay(period = 'week', count = 7) {
    const now = new Date();
    const end = startOfDay(now);
    const start = new Date(end);

    if (period === 'week') {
        start.setUTCDate(start.getUTCDate() - 6);
    } else {
        start.setUTCDate(start.getUTCDate() - count + 1);
    }

    const { labels, grouped } = await _aggregateGrouped('day', null, start, end);

    const billCountData = labels.map(k =>
        grouped[k] ? grouped[k].billCount : 0
    );
    const avgBillData = labels.map(k => {
        const g = grouped[k];
        return g && g.billCount > 0
            ? Math.round((g.revenue / g.billCount) * 100) / 100
            : 0;
    });

    return {
        labels,
        datasets: { billCount: billCountData, avgBillValue: avgBillData },
        meta: { period, count: labels.length }
    };
}

// =====================================================
// CHART 10: NGUYÊN LIỆU CẦN CHUẨN BỊ + PID PREDICTION
// =====================================================

/**
 * @param {'day'|'week'} period   - Chu kỳ hiện tại
 * @param {string}       date     - Ngày tham chiếu
 * @returns {Promise<object>}
 */
async function getIngredientPreparation(period = 'day', date) {
    const ref = startOfDay(date || new Date());
    let start, end;

    if (period === 'day') {
        start = ref;
        end = endOfDay(ref);
    } else {
        start = startOfWeek(ref);
        end = endOfDay(new Date(start.getTime() + 6 * 86400000));
    }

    // Lấy usage trong kỳ hiện tại
    const currentSnapshots = await DailySnapshot.find({
        date: { $gte: start, $lte: end }
    }).lean();

    // Tổng hợp usage hiện tại
    const currentUsage = {};
    for (const snap of currentSnapshots) {
        for (const ing of snap.ingredientUsage || []) {
            const key = String(ing.ingredientId);
            if (!currentUsage[key]) {
                currentUsage[key] = {
                    ingredientId: ing.ingredientId,
                    ingredientName: ing.ingredientName,
                    smallUnit: ing.smallUnit,
                    largeUnit: ing.largeUnit,
                    quantityUsed: 0
                };
            }
            currentUsage[key].quantityUsed += ing.quantityUsed;
        }
    }

    // Lấy lịch sử 8 chu kỳ trước để tính PID
    const HISTORY_COUNT = 8;
    const historyStart = new Date(start);
    const periodDays = period === 'day' ? 1 : 7;
    historyStart.setUTCDate(historyStart.getUTCDate() - periodDays * HISTORY_COUNT);
    const historyEnd = new Date(start);
    historyEnd.setUTCDate(historyEnd.getUTCDate() - 1);

    const historySnapshots = await DailySnapshot.find({
        date: { $gte: historyStart, $lte: endOfDay(historyEnd) }
    }).lean();

    // Nhóm lịch sử theo chu kỳ
    const historyByPeriod = {};
    for (const snap of historySnapshots) {
        let periodKey;
        if (period === 'day') {
            periodKey = formatLabel(snap.date, 'day');
        } else {
            periodKey = formatLabel(startOfWeek(snap.date), 'week');
        }
        if (!historyByPeriod[periodKey]) historyByPeriod[periodKey] = {};
        for (const ing of snap.ingredientUsage || []) {
            const key = String(ing.ingredientId);
            if (!historyByPeriod[periodKey][key]) {
                historyByPeriod[periodKey][key] = {
                    ingredientId: ing.ingredientId,
                    ingredientName: ing.ingredientName,
                    smallUnit: ing.smallUnit,
                    largeUnit: ing.largeUnit,
                    quantityUsed: 0
                };
            }
            historyByPeriod[periodKey][key].quantityUsed += ing.quantityUsed;
        }
    }

    const periodKeys = Object.keys(historyByPeriod).sort();

    // Thu thập tất cả ingredient IDs
    const allIngredientIds = new Set([
        ...Object.keys(currentUsage),
        ...periodKeys.flatMap(pk =>
            Object.keys(historyByPeriod[pk])
        )
    ]);

    // Lấy hoặc tạo PID state cho từng nguyên liệu
    const results = [];

    for (const ingId of allIngredientIds) {
        // Lịch sử usage theo từng chu kỳ
        const usageHistory = periodKeys.map(pk =>
            historyByPeriod[pk][ingId]?.quantityUsed || 0
        );

        const current = currentUsage[ingId];
        const sample = current
            || Object.values(historyByPeriod)
                .map(p => p[ingId])
                .find(Boolean);

        if (!sample) continue;

        // Setpoint = trung bình lịch sử
        const setpoint = computeSetpoint(usageHistory);

        // Lấy hoặc tạo PID state
        let pidState = await PIDState.findOne({ ingredientId: ingId });
        if (!pidState) {
            pidState = new PIDState({
                ingredientId: sample.ingredientId,
                ingredientName: sample.ingredientName,
                smallUnit: sample.smallUnit || '',
                setpoint,
                Kp: 0.6,
                Ki: 0.1,
                Kd: 0.05,
                integralError: 0,
                lastError: 0,
                usageHistory
            });
        } else {
            // Cập nhật setpoint
            pidState.setpoint = setpoint;
            pidState.usageHistory = usageHistory;
        }

        // Tính PID output = dự đoán cho chu kỳ tiếp theo
        const pidResult = computePIDOutput(
            usageHistory,
            setpoint,
            {
                integralError: pidState.integralError,
                lastError: pidState.lastError
            },
            {
                Kp: pidState.Kp,
                Ki: pidState.Ki,
                Kd: pidState.Kd
            }
        );

        // Cập nhật PID state
        pidState.integralError = pidResult.integralError;
        pidState.lastError = pidResult.lastError;
        pidState.lastUpdatedAt = new Date();
        await pidState.save();

        results.push({
            ingredientId: sample.ingredientId,
            ingredientName: sample.ingredientName,
            smallUnit: sample.smallUnit || '',
            largeUnit: sample.largeUnit || '',

            // Đã dùng trong kỳ hiện tại
            currentUsage: current
                ? Math.round(current.quantityUsed * 100) / 100
                : 0,

            // Trung bình lịch sử (setpoint)
            historicalAvg: Math.round(setpoint * 100) / 100,

            // PID prediction cho kỳ tiếp theo
            predictedNextPeriod: pidResult.output,

            // Lịch sử để render mini chart
            usageHistory: usageHistory.map(v => Math.round(v * 100) / 100),
            historyLabels: periodKeys
        });
    }

    // Sắp xếp theo tên
    results.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

    return {
        period,
        date: ref.toISOString().slice(0, 10),
        ingredients: results,
        meta: {
            currentPeriodStart: start.toISOString().slice(0, 10),
            currentPeriodEnd: end.toISOString().slice(0, 10),
            historyCount: HISTORY_COUNT
        }
    };
}

// =====================================================
// INTERNAL HELPERS
// =====================================================

/**
 * Aggregate dữ liệu DailySnapshot theo period → trả về labels + grouped map
 */
async function _aggregateGrouped(
    period = 'day',
    count = 30,
    customStart = null,
    customEnd = null
) {
    const now = new Date();
    let start = customStart;
    let end = customEnd || endOfDay(now);

    if (!start) {
        start = startOfDay(now);
        if (period === 'day') {
            start.setUTCDate(start.getUTCDate() - count + 1);
        } else if (period === 'week') {
            const ws = startOfWeek(now);
            start = new Date(ws);
            start.setUTCDate(start.getUTCDate() - (count - 1) * 7);
        } else {
            start = startOfMonth(now);
            start.setUTCMonth(start.getUTCMonth() - (count - 1));
        }
    }

    const snapshots = await DailySnapshot.find({
        date: { $gte: start, $lte: end }
    })
        .sort({ date: 1 })
        .lean();

    const grouped = {};
    for (const snap of snapshots) {
        let key;
        if (period === 'week') {
            key = formatLabel(startOfWeek(snap.date), 'week');
        } else if (period === 'month') {
            key = formatLabel(snap.date, 'month');
        } else {
            key = formatLabel(snap.date, 'day');
        }
        if (!grouped[key]) {
            grouped[key] = {
                revenue: 0,
                cost: 0,
                grossProfit: 0,
                billCount: 0,
                discountAmount: 0
            };
        }
        grouped[key].revenue += snap.revenue;
        grouped[key].cost += snap.cost;
        grouped[key].grossProfit += snap.grossProfit;
        grouped[key].billCount += snap.billCount;
        grouped[key].discountAmount += snap.discountAmount;
    }

    const labels = Object.keys(grouped).sort();
    return { labels, grouped };
}

/**
 * Aggregate một metric đơn lẻ
 */
async function _aggregateMetric(period, count, getter) {
    const { labels, grouped } = await _aggregateGrouped(period, count);
    const rawData = labels.map(k => {
        const g = grouped[k];
        return Math.round(getter(g) * 100) / 100;
    });
    return { labels, rawData };
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    // Snapshot
    buildDailySnapshot,
    buildSnapshotsForRange,

    // Charts
    getRevenueDailyWithEMA,        // Chart 1
    getRevenueByPeriod,            // Chart 2
    getRevenueCustomRange,         // Chart 3
    getBillCountWithEMA,           // Chart 4
    getAvgBillValueWithEMA,        // Chart 5
    getRevenueCostProfit,          // Chart 6
    getCumulativeProfitByMonth,    // Chart 7
    getTopFoods,                   // Chart 8
    getTrafficByHour,              // Chart 9 (theo giờ)
    getTrafficByDay,               // Chart 9 (theo ngày)
    getIngredientPreparation,      // Chart 10

    // Utils (export để test)
    computeEMA,
    computeMA,
    computePIDOutput,
    computeSetpoint,
    autoGranularity
};