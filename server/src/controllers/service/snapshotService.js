// services/snapshotService.js
//
// Đọc Order (status=COMPLETED) trong một khoảng ngày
// và upsert vào DailySnapshot.
//
// Dùng trong 2 tình huống:
//   1. Gọi thủ công qua POST /api/analyst/build-snapshots
//      (backfill lịch sử hoặc rebuild khi data bị lệch)
//   2. Gọi tự động sau mỗi lần tạo/hoàn tất đơn hàng
//      (trong OrderController.createOrder)

const Order          = require('../../models/OrderModel');
const { DailySnapshot } = require('../../models/AnalystModel');

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

// ─── Build snapshot cho 1 ngày ────────────────────────────────────────────────

async function buildSnapshotForDate(date = new Date()) {
    const start = startOfDay(date);
    const end   = endOfDay(date);

    const orders = await Order.find({
        createdAt: { $gte: start, $lte: end },
        status:    'COMPLETED',
    }).lean();

    // Không có đơn → xoá snapshot cũ (nếu có) rồi trả null
    if (orders.length === 0) {
        await DailySnapshot.deleteOne({ date: start });
        return null;
    }

    // ── Tổng quan ─────────────────────────────────────────────────────────────
    const revenue        = orders.reduce((s, o) => s + (o.totalAmount    ?? 0), 0);
    const cost           = orders.reduce((s, o) => s + (o.totalCost      ?? 0), 0);
    const discountAmount = orders.reduce((s, o) => s + (o.discountAmount ?? 0), 0);
    const grossProfit    = revenue - cost;
    const billCount      = orders.length;
    const avgBillValue   = billCount > 0
        ? Math.round(revenue / billCount)
        : 0;

    // ── Hourly traffic (giờ 7 → 21) ───────────────────────────────────────────
    const hourMap = {};
    for (let h = 7; h <= 21; h++) {
        hourMap[h] = { hour: h, revenue: 0, billCount: 0 };
    }

    for (const o of orders) {
        const h = new Date(o.createdAt).getHours();
        if (hourMap[h]) {
            hourMap[h].revenue    += o.totalAmount ?? 0;
            hourMap[h].billCount  += 1;
        }
    }

    const hourlyTraffic = Object.values(hourMap).map(h => ({
        ...h,
        avgBillValue: h.billCount > 0
            ? Math.round(h.revenue / h.billCount)
            : 0,
    }));

    // ── Food sales ────────────────────────────────────────────────────────────
    const foodMap = {};

    for (const o of orders) {
        for (const item of (o.items ?? [])) {
            const key = item.foodId?.toString();
            if (!key) continue;

            if (!foodMap[key]) {
                foodMap[key] = {
                    foodId:       item.foodId,
                    foodName:     item.foodName,
                    categoryId:   '',        // có thể populate từ Food nếu cần
                    quantitySold: 0,
                    revenue:      0,
                    cost:         0,
                    grossProfit:  0,
                };
            }

            foodMap[key].quantitySold += item.quantity;
            foodMap[key].revenue      += item.total                              ?? 0;
            foodMap[key].cost         += (item.costPriceSnapshot ?? 0) * item.quantity;
            foodMap[key].grossProfit  += item.grossProfit                        ?? 0;
        }
    }

    const foodSales = Object.values(foodMap);

    // ── Ingredient usage ──────────────────────────────────────────────────────
    const ingMap = {};

    for (const o of orders) {
        for (const item of (o.items ?? [])) {
            for (const snap of (item.ingredientSnapshots ?? [])) {
                const key = snap.ingredientId?.toString();
                if (!key) continue;

                if (!ingMap[key]) {
                    ingMap[key] = {
                        ingredientId:   snap.ingredientId,
                        ingredientName: snap.ingredientName ?? '',
                        smallUnit:      snap.unit           ?? '',
                        largeUnit:      '',
                        quantityUsed:   0,
                    };
                }

                // snap.quantity = lượng / 1 phần; nhân với số lượng món
                ingMap[key].quantityUsed +=
                    (snap.quantity ?? 0) * item.quantity;
            }
        }
    }

    const ingredientUsage = Object.values(ingMap);

    // ── Upsert ────────────────────────────────────────────────────────────────
    const snapshot = await DailySnapshot.findOneAndUpdate(
        { date: start },
        {
            $set: {
                date:             start,
                revenue,
                cost,
                grossProfit,
                discountAmount,
                billCount,
                avgBillValue,
                hourlyTraffic,
                foodSales,
                ingredientUsage,
                isFinalized:      true,
                lastComputedAt:   new Date(),
            },
        },
        { upsert: true, new: true }
    );

    return snapshot;
}

// ─── Build snapshot cho nhiều ngày liên tiếp ──────────────────────────────────

async function buildSnapshotsForRange(fromDate, toDate) {
    const results = [];
    const cursor  = startOfDay(new Date(fromDate));
    const limit   = startOfDay(new Date(toDate));

    while (cursor <= limit) {
        const snap = await buildSnapshotForDate(new Date(cursor));
        if (snap) results.push(snap);
        cursor.setDate(cursor.getDate() + 1);
    }

    return results;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    buildSnapshotForDate,
    buildSnapshotsForRange,
};