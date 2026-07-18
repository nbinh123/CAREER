// controllers/AnalystController.js

const Order = require("../models/OrderModel");
const Food = require("../models/FoodModel");
const { DailySnapshot, PIDState } = require("../models/AnalystModel");
const {
    buildSnapshotForDate,
    buildSnapshotsForRange,
} = require("./service/snapshotService");


// =====================================================
// HELPER: tạo khoảng ngày [from, to]
// =====================================================

function _getDateRange(days) {
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);

    return { from, to };
}

// =====================================================
// HELPER: validate tham số days
// =====================================================

function _validateDays(days) {
    return [7, 14, 21, 30].includes(days);
}

// ─── PID helper (mirror của UI, chạy phía server) ────────────────────────────
function pidCalc(history, expected, Kp, Ki, Kd) {
    const n = history.length;
    if (n === 0) return { pred: expected, pTerm: 0, iTerm: 0, dTerm: 0, e: 0, sumE: 0, dE: 0 };
    const errors = history.map(h => expected - h);
    const e = errors[n - 1];
    const sumE = errors.reduce((s, x) => s + x, 0);
    const dE = n >= 2 ? errors[n - 1] - errors[n - 2] : 0;
    const pTerm = Kp * e;
    const iTerm = Ki * sumE;
    const dTerm = Kd * dE;
    const pred = Math.max(0, history[n - 1] + pTerm + iTerm + dTerm);
    return { pred: Math.round(pred * 10) / 10, pTerm, iTerm, dTerm, e, sumE, dE };
}

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

// Lấy N ngày gần nhất từ DailySnapshot, sort tăng dần
async function getLastNSnapshots(n) {
    const end = endOfDay();
    const start = startOfDay(new Date(Date.now() - (n - 1) * 86_400_000));
    return DailySnapshot.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 });
}
// ── Lấy snapshot từ ngày 1 đầu tháng hiện tại đến hôm nay ──
async function getSnapshotsByDateRange(start, end) {
    return DailySnapshot.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 });
}
// Aggregate orders → hourly buckets cho một ngày cụ thể
// Dùng làm fallback khi chưa có snapshot
async function buildHourlyFromOrders(date) {
    const start = startOfDay(date);
    const end = endOfDay(date);

    const orders = await Order.find({
        createdAt: { $gte: start, $lte: end },
        status: "COMPLETED",
    });

    const buckets = {};
    for (let h = 7; h <= 21; h++) {
        buckets[h] = { revenue: 0, bills: 0, cost: 0 };
    }

    for (const o of orders) {
        const h = new Date(o.createdAt).getHours();
        if (buckets[h]) {
            buckets[h].revenue += o.totalAmount ?? 0;
            buckets[h].bills += 1;
            buckets[h].cost += o.totalCost ?? 0;
        }
    }

    return Object.entries(buckets).map(([h, d]) => ({
        label: `${h}h`,
        revenue: d.revenue,
        bills: d.bills,
        avgBill: d.bills > 0 ? Math.round(d.revenue / d.bills) : 0,
        cost: d.cost,
        profit: d.revenue - d.cost,
    }));
}

// ─── Label helpers ────────────────────────────────────────────────────────────
const DOW_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]; // getDay() index

function snapshotToRow(snap, labelOverride) {
    return {
        label: labelOverride ?? DOW_LABEL[new Date(snap.date).getDay()],
        revenue: snap.revenue,
        bills: snap.billCount,
        avgBill: snap.avgBillValue,
        cost: snap.cost,
        profit: snap.grossProfit,
    };
}

// Trả về { monday, sunday } của tuần cách hiện tại offset tuần
// offset=0 → tuần này, offset=1 → tuần trước, offset=2 → 2 tuần trước, …
function getWeekRange(offset = 0) {
    const now = new Date();
    // getDay(): 0=CN, 1=T2, …, 6=T7
    const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = startOfDay(
        new Date(now - (daysSinceMonday + offset * 7) * 86_400_000)
    );
    const sunday = endOfDay(
        new Date(+monday + 6 * 86_400_000)
    );
    return { monday, sunday };
}

// Trả về { firstDay, lastDay } của tháng cách hiện tại offset tháng
// offset=0 → tháng này, offset=1 → tháng trước, offset=2 → 2 tháng trước, …
function getMonthRange(offset = 0) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() - offset; // Date tự xử lý month âm
    const firstDay = startOfDay(new Date(year, month, 1));
    const lastDay = endOfDay(new Date(year, month + 1, 0)); // day=0 → ngày cuối tháng trước
    return { firstDay, lastDay };
}

// ─── Controller ───────────────────────────────────────────────────────────────
class AnalystController {

    // ── 1. Stat cards ─────────────────────────────────────────────────────────
    // GET /api/analyst/stats
    // Response: { totalRev, totalBills, avgBill, totalCost }
    async getStats(req, res) {
        try {
            const snaps = await getLastNSnapshots(7);

            // ── Happy path: đã có snapshot ────────────────────────────────────
            if (snaps.length > 0) {
                const totalRev = snaps.reduce((s, d) => s + d.revenue, 0);
                const totalBills = snaps.reduce((s, d) => s + d.billCount, 0);
                const totalCost = snaps.reduce((s, d) => s + d.cost, 0);

                return res.json({
                    success: true,
                    data: {
                        totalRev,
                        totalBills,
                        avgBill: totalBills > 0 ? Math.round(totalRev / totalBills) : 0,
                        totalCost,
                    },
                });
            }

            // ── Fallback: chưa có snapshot → đọc thẳng từ Order ──────────────
            // Xảy ra khi vừa cài mới hoặc chưa chạy build-snapshots lần nào.
            // Tự động build snapshot hôm nay luôn để lần sau không cần fallback.
            const end = endOfDay();
            const start = startOfDay(new Date(Date.now() - 6 * 86_400_000));

            const orders = await Order.find({
                createdAt: { $gte: start, $lte: end },
                status: "COMPLETED",
            }).lean();

            // Build snapshot hôm nay bất đồng bộ (không block response)
            buildSnapshotForDate(new Date()).catch(e =>
                console.error("[AnalystController] auto-build snapshot failed:", e.message)
            );

            const totalRev = orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
            const totalBills = orders.length;
            const totalCost = orders.reduce((s, o) => s + (o.totalCost ?? 0), 0);

            return res.json({
                success: true,
                data: {
                    totalRev,
                    totalBills,
                    avgBill: totalBills > 0 ? Math.round(totalRev / totalBills) : 0,
                    totalCost,
                },
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 2. Chart data (dùng chung cho chart 1-2 + chart 4-6-8) ───────────────
    // GET /api/analyst/chart-data?tf=day|week|month
    // Response: Array<{ label, revenue, bills, avgBill, cost, profit }>
    // tf=day   → 15 giờ (7h–21h) của hôm nay
    // tf=week  → 7 ngày gần nhất (T2→CN)
    // tf=month → 30 ngày gần nhất
    async getChartData(req, res) {
        try {
            const { tf = "day" } = req.query;
            let data = [];

            if (tf === "day") {
                const today = startOfDay();
                const snapshot = await DailySnapshot.findOne({ date: today });

                if (snapshot?.hourlyTraffic?.length) {
                    // Bổ sung cost + profit bằng cách chia đều (snapshot không lưu theo giờ)
                    const hourMap = Object.fromEntries(
                        snapshot.hourlyTraffic.map(h => [h.hour, h])
                    );
                    const costPerBill = snapshot.billCount > 0
                        ? snapshot.cost / snapshot.billCount
                        : 0;

                    data = Array.from({ length: 15 }, (_, i) => {
                        const h = i + 7;
                        const row = hourMap[h];
                        if (!row) return { label: `${h}h`, revenue: 0, bills: 0, avgBill: 0, cost: 0, profit: 0 };
                        const cost = Math.round(row.billCount * costPerBill);
                        return {
                            label: `${h}h`,
                            revenue: row.revenue,
                            bills: row.billCount,
                            avgBill: row.avgBillValue,
                            cost,
                            profit: row.revenue - cost,
                        };
                    });
                } else {
                    // Fallback: tính thẳng từ Order
                    data = await buildHourlyFromOrders(today);
                }
            } else if (tf === "week") {
                const snaps = await getLastNSnapshots(7);
                data = snaps.map(s => snapshotToRow(s));
            } else if (tf === "month") {
                const snaps = await getLastNSnapshots(30);
                data = snaps.map(s => snapshotToRow(s, `${new Date(s.date).getDate()}`));
            } else {
                return res.status(400).json({ success: false, message: "tf phải là day | week | month" });
            }

            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 3. Date-range chart (chart 3) ─────────────────────────────────────────
    // GET /api/analyst/range?from=YYYY-MM-DD&to=YYYY-MM-DD
    // Response: Array<{ label: "D/M", revenue }>
    async getRangeData(req, res) {
        try {
            const { from, to } = req.query;
            if (!from || !to) {
                return res.status(400).json({ success: false, message: "Thiếu tham số from hoặc to" });
            }

            const fromDate = new Date(from);
            const toDate = endOfDay(new Date(to));

            if (isNaN(fromDate) || isNaN(toDate) || toDate < fromDate) {
                return res.status(400).json({ success: false, message: "Khoảng thời gian không hợp lệ" });
            }

            const snaps = await DailySnapshot.find({
                date: { $gte: fromDate, $lte: toDate },
            }).sort({ date: 1 });

            const data = snaps.map(s => {
                const d = new Date(s.date);
                return { label: `${d.getDate()}/${d.getMonth() + 1}`, revenue: s.revenue };
            });

            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // GET /api/analyst/cumulative
    // Response: Array<{ day, profit, cumulativeProfit }>
    async getCumulative(req, res) {
        try {
            const now = new Date();
            const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
            const end = endOfDay();

            const snaps = await getSnapshotsByDateRange(start, end);

            let acc = 0;
            const data = snaps.map(s => {
                acc += s.grossProfit;
                return {
                    day: new Date(s.date).getDate(),
                    profit: s.grossProfit,
                    cumulativeProfit: acc,
                };
            });

            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
    

    // ── 5. Top món bán chạy – pie chart (chart 9) ────────────────────────────
    // GET /api/analyst/top-dishes?period=day|week
    // Response: Array<{ name, value }> — top 5 + "Các món khác"
    async getTopDishes(req, res) {
        try {
            const { period = "day" } = req.query;
            const n = period === "week" ? 7 : 1;
            const snaps = await getLastNSnapshots(n);

            // Cộng dồn quantitySold theo từng foodId
            const map = {};
            for (const snap of snaps) {
                for (const f of snap.foodSales) {
                    const key = f.foodId.toString();
                    if (!map[key]) map[key] = { name: f.foodName, value: 0 };
                    map[key].value += f.quantitySold;
                }
            }

            const sorted = Object.values(map).sort((a, b) => b.value - a.value);
            const top5 = sorted.slice(0, 5);
            const others = sorted.slice(5).reduce((s, d) => s + d.value, 0);

            const data = others > 0
                ? [...top5, { name: "Các món khác", value: others }]
                : top5;

            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 6. Heatmap (chart 9) ──────────────────────────────────────────────────
    // GET /api/analyst/heatmap
    // Response: Array[7][15] of { day, hour, val }
    // day=0→T2 … day=6→CN, hour 7–21
    async getHeatmap(req, res) {
        try {
            const snaps = await getLastNSnapshots(7);

            // Khởi tạo ma trận 7 ngày × 15 giờ = 0
            const matrix = Array.from({ length: 7 }, (_, di) =>
                Array.from({ length: 15 }, (_, hi) => ({ day: di, hour: hi + 7, val: 0 }))
            );

            for (const snap of snaps) {
                const dow = new Date(snap.date).getDay();         // 0=CN
                const di = dow === 0 ? 6 : dow - 1;             // T2=0 … CN=6
                for (const h of snap.hourlyTraffic) {
                    const hi = h.hour - 7;
                    if (hi >= 0 && hi < 15) matrix[di][hi].val = h.billCount;
                }
            }

            res.json({ success: true, data: matrix });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 7. PID nguyên liệu (chart 10) ────────────────────────────────────────
    // GET /api/analyst/pid?tf=day|week
    // Response: Array<PID row> — luôn trả cả dayHistory lẫn weekHistory
    // để UI không mất dữ liệu khi chuyển tab trước khi re-fetch xong.
    async getPidData(req, res) {
        try {
            const { tf = "day" } = req.query;
            const pidStates = await PIDState.find({}).lean();
            const N = 6; // số kỳ lịch sử hiển thị trên sparkline

            const data = pidStates.map(ing => {
                const rawHistory = ing.usageHistory ?? [];

                // ── Daily: N ngày gần nhất ─────────────────────────────────
                const dayHistory = rawHistory.slice(-N);
                const dayExpected = ing.setpoint ?? 0;

                // ── Weekly: gom mỗi 7 ngày → 1 điểm, lấy N tuần gần nhất ──
                // Dùng Math.max để tránh index âm khi rawHistory ngắn hơn N*7
                const weekChunks = [];
                const startIdx = Math.max(0, rawHistory.length - N * 7);
                for (let i = startIdx; i < rawHistory.length; i += 7) {
                    const slice = rawHistory.slice(i, i + 7);
                    if (slice.length) weekChunks.push(slice.reduce((s, v) => s + v, 0));
                }
                const weekHistory = weekChunks.slice(-N);
                const weekExpected = dayExpected * 7;

                // ── PID tính sẵn theo tf hiện tại ─────────────────────────
                const hist = tf === "day" ? dayHistory : weekHistory;
                const exp = tf === "day" ? dayExpected : weekExpected;
                const { pred, pTerm, iTerm, dTerm, e } = pidCalc(
                    hist, exp, ing.Kp ?? 0, ing.Ki ?? 0, ing.Kd ?? 0
                );

                return {
                    ingredientId: ing.ingredientId,
                    name: ing.ingredientName ?? "—",
                    unit: ing.smallUnit || ing.largeUnit || "",
                    Kp: ing.Kp ?? 0,
                    Ki: ing.Ki ?? 0,
                    Kd: ing.Kd ?? 0,
                    // Luôn trả cả hai lịch sử — UI tự chọn theo tab
                    dayHistory,
                    weekHistory,
                    dayExpected,
                    weekExpected,
                    // PID tính sẵn cho tf hiện tại (UI có thể tính lại khi thay K)
                    predicted: pred,
                    pTerm, iTerm, dTerm, e,
                };
            });

            res.json({ success: true, data });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 8. Cập nhật tham số K cho một nguyên liệu ─────────────────────────────
    // PATCH /api/analyst/pid/:ingredientId
    // Body: { Kp, Ki, Kd }
    async updatePidParams(req, res) {
        try {
            const { ingredientId } = req.params;
            const { Kp, Ki, Kd } = req.body;

            if ([Kp, Ki, Kd].some(v => v === undefined || isNaN(v))) {
                return res.status(400).json({ success: false, message: "Kp, Ki, Kd phải là số hợp lệ" });
            }

            const updated = await PIDState.findOneAndUpdate(
                { ingredientId },
                { $set: { Kp: +Kp, Ki: +Ki, Kd: +Kd } },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ success: false, message: "Không tìm thấy PID state cho nguyên liệu này" });
            }

            res.json({ success: true, data: updated });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 9. Build / rebuild DailySnapshot từ Order ─────────────────────────────
    // POST /api/analyst/build-snapshots
    // Body (tuỳ chọn): { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
    // Mặc định: 30 ngày gần nhất.
    // Dùng khi: cài mới, data bị lệch, hoặc muốn backfill lịch sử.
    async buildSnapshots(req, res) {
        try {
            const { from, to } = req.body ?? {};

            const toDate = to ? new Date(to) : new Date();
            const fromDate = from
                ? new Date(from)
                : new Date(Date.now() - 29 * 86_400_000); // 30 ngày gần nhất

            if (isNaN(fromDate) || isNaN(toDate) || toDate < fromDate) {
                return res.status(400).json({
                    success: false,
                    message: "Khoảng thời gian không hợp lệ",
                });
            }

            const results = await buildSnapshotsForRange(fromDate, toDate);

            res.json({
                success: true,
                message: `Đã tạo / cập nhật ${results.length} snapshot`,
                data: results.map(s => ({
                    date: s.date,
                    billCount: s.billCount,
                    revenue: s.revenue,
                    cost: s.cost,
                })),
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 10. Số liệu theo tuần ─────────────────────────────────────────────────
    // GET /api/analyst/weekly?offset=0
    // offset=0 → tuần này (T2→CN), offset=1 → tuần trước, offset=2 → 2 tuần trước, …
    // Response: { periodStart, periodEnd, totalRevenue, totalBills, avgBill,
    //             totalCost, totalProfit,
    //             days: [{ label, revenue, bills, avgBill, cost, profit }] }
    async getWeeklySummary(req, res) {
        try {
            const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
            const { monday, sunday } = getWeekRange(offset);

            const snaps = await DailySnapshot.find({
                date: { $gte: monday, $lte: sunday },
            }).sort({ date: 1 });

            // Lập map theo label ngày (T2…CN) để fill đủ 7 ngày dù thiếu snapshot
            const snapByLabel = {};
            for (const s of snaps) {
                const dow = new Date(s.date).getDay(); // 0=CN
                const label = DOW_LABEL[dow];            // "CN","T2",…
                snapByLabel[label] = s;
            }

            const WEEK_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
            const days = WEEK_LABELS.map(label => {
                const s = snapByLabel[label];
                return {
                    label,
                    revenue: s?.revenue ?? 0,
                    bills: s?.billCount ?? 0,
                    avgBill: s?.avgBillValue ?? 0,
                    cost: s?.cost ?? 0,
                    profit: s?.grossProfit ?? 0,
                };
            });

            const totalRevenue = days.reduce((a, b) => a + b.revenue, 0);
            const totalBills = days.reduce((a, b) => a + b.bills, 0);
            const totalCost = days.reduce((a, b) => a + b.cost, 0);

            return res.json({
                success: true,
                data: {
                    offset,
                    totalRevenue,
                    totalBills,
                    avgBill: totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0,
                    totalCost,
                    days
                },
            });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // ── 11. Số liệu theo tháng ────────────────────────────────────────────────
    // GET /api/analyst/monthly?offset=0
    // offset=0 → tháng này, offset=1 → tháng trước, offset=2 → 2 tháng trước, …
    // Response: { periodStart, periodEnd, totalRevenue, totalBills, avgBill,
    //             totalCost, totalProfit,
    //             days: [{ label: "1"…"31", revenue, bills, avgBill, cost, profit }] }
    async getMonthlySummary(req, res) {
        try {
            const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
            const { firstDay, lastDay } = getMonthRange(offset);

            const snaps = await DailySnapshot.find({
                date: { $gte: firstDay, $lte: lastDay },
            }).sort({ date: 1 });

            // Map theo ngày-trong-tháng (string "1"…"31")
            const snapByDay = {};
            for (const s of snaps) {
                const dayNum = String(new Date(s.date).getDate());
                snapByDay[dayNum] = s;
            }

            // Sinh đủ số ngày trong tháng
            const daysInMonth = new Date(
                firstDay.getFullYear(),
                firstDay.getMonth() + 1,
                0
            ).getDate();

            const days = Array.from({ length: daysInMonth }, (_, i) => {
                const label = String(i + 1);
                const s = snapByDay[label];
                return {
                    label,
                    revenue: s?.revenue ?? 0,
                    bills: s?.billCount ?? 0,
                    avgBill: s?.avgBillValue ?? 0,
                    cost: s?.cost ?? 0,
                    profit: s?.grossProfit ?? 0,
                };
            });

            const totalRevenue = days.reduce((a, b) => a + b.revenue, 0);
            const totalBills = days.reduce((a, b) => a + b.bills, 0);
            const totalCost = days.reduce((a, b) => a + b.cost, 0);

            return res.json({
                success: true,
                data: {
                    periodStart: firstDay,
                    periodEnd: lastDay,
                    offset,
                    totalRevenue,
                    totalBills,
                    avgBill: totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0,
                    totalCost,
                    totalProfit: totalRevenue - totalCost,
                    days,
                },
            });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    async getLast7DaysRevenue(req, res) {
        try {
            const snaps = await getLastNSnapshots(7);

            const data = snaps.map(s => {
                const date = new Date(s.date);

                return {
                    d: `${date.getDate()}/${date.getMonth() + 1}`,
                    v: s.revenue
                };
            });

            res.json({
                success: true,
                data
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }

    // =====================================================
    // 1. CẬP NHẬT TRỌNG SỐ CHO TỪNG MÓN
    //    GET /api/orders/update-food-weights?days=7
    //
    //    Trọng số = quantitySold(món) / totalQuantitySold
    //    Món không có đơn trong kỳ → trọng số = 0
    //    Ghi vào Food.aiTrainingWeight
    // =====================================================

    async updateFoodWeights(req, res) {
        try {
            const days = parseInt(req.query.days) || 30;

            if (!_validateDays(days)) {
                return res.status(400).json({
                    message: "days must be one of: 7, 14, 21, 30"
                });
            }

            const { from, to } = _getDateRange(days);

            // ── Tổng số lượng từng món bán được trong kỳ ──────────────────────────
            const salesData = await Order.aggregate([
                {
                    $match: {
                        status: "COMPLETED",
                        createdAt: { $gte: from, $lte: to }
                    }
                },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.foodId",
                        quantitySold: { $sum: "$items.quantity" }
                    }
                }
            ]);

            // ── Tổng số lượng tất cả món ──────────────────────────────────────────
            const totalSold = salesData.reduce(
                (sum, f) => sum + f.quantitySold,
                0
            );

            // ── Map: foodId → weight ───────────────────────────────────────────────
            const weightMap = {};
            if (totalSold > 0) {
                for (const item of salesData) {
                    weightMap[item._id.toString()] =
                        item.quantitySold / totalSold;
                }
            }

            // ── Lấy toàn bộ foods rồi bulkWrite ───────────────────────────────────
            const allFoods = await Food.find({}).lean();

            const bulkOps = allFoods.map(food => ({
                updateOne: {
                    filter: { _id: food._id },
                    update: {
                        $set: {
                            aiTrainingWeight:
                                weightMap[food._id.toString()] ?? 0
                        }
                    }
                }
            }));

            await Food.bulkWrite(bulkOps);

            // ── Response ──────────────────────────────────────────────────────────
            return res.json({
                message: "Food weights updated successfully",
                period: { days, from, to },
                totalSold,
                updatedCount: allFoods.length,
                weights: allFoods.map(food => ({
                    foodId: food._id,
                    foodName: food.foodName,
                    aiTrainingWeight: weightMap[food._id.toString()] ?? 0
                }))
            });

        } catch (error) {
            console.error("Error updating food weights:", error);
            return res.status(500).json({
                message: error.message || "Internal server error"
            });
        }
    }

    // =====================================================
    // 2 & 3. BIÊN LỢI NHUẬN TƯƠNG ĐỐI TỪNG MÓN
    //         + BIÊN LỢI NHUẬN TỔNG HỢP (%)
    //    GET /api/orders/margin-analytics?days=7
    //
    //    relativeProfitMargin(món) = profitMargin × weight
    //    compositeMargin            = Σ relativeProfitMargin  (× 100 → %)
    // =====================================================

    async getMarginAnalytics(req, res) {
        try {
            const days = parseInt(req.query.days) || 30;

            if (!_validateDays(days)) {
                return res.status(400).json({
                    message: "days must be one of: 7, 14, 21, 30"
                });
            }

            const { from, to } = _getDateRange(days);

            // ── Lấy DailySnapshot thay vì query Order + FoodModel ─────────────────
            const snaps = await DailySnapshot.find({
                date: { $gte: from, $lte: to }
            }).lean();

            // ── Tổng doanh thu & lợi nhuận gộp (cùng nguồn với getCumulative) ─────
            const totalRevenue = snaps.reduce((s, d) => s + (d.revenue ?? 0), 0);
            const totalGrossProfit = snaps.reduce((s, d) => s + (d.grossProfit ?? 0), 0);

            // ── compositeMarginPercent = totalGrossProfit / totalRevenue × 100 ─────
            // Nhất quán hoàn toàn với getCumulative: không còn chênh lệch
            const compositeMarginPercent = totalRevenue > 0
                ? parseFloat(((totalGrossProfit / totalRevenue) * 100).toFixed(2))
                : 0;

            // ── Gom foodSales từ tất cả snapshots (revenue-weighted) ─────────────
            const foodMap = {};
            for (const snap of snaps) {
                for (const f of (snap.foodSales ?? [])) {
                    const key = f.foodId?.toString();
                    if (!key) continue;

                    if (!foodMap[key]) {
                        foodMap[key] = {
                            foodId: f.foodId,
                            foodName: f.foodName,
                            revenue: 0,
                            cost: 0,
                            grossProfit: 0,
                            quantitySold: 0
                        };
                    }

                    foodMap[key].revenue += f.revenue ?? 0;
                    foodMap[key].cost += f.cost ?? 0;
                    foodMap[key].grossProfit += f.grossProfit ?? 0;
                    foodMap[key].quantitySold += f.quantitySold ?? 0;
                }
            }

            // weight = revenue_món / totalRevenue  →  Σ(relativeProfitMargin) = compositeMargin
            const foods = Object.values(foodMap).map(f => {
                const profitMargin = f.revenue > 0 ? f.grossProfit / f.revenue : 0;
                const weight = totalRevenue > 0 ? f.revenue / totalRevenue : 0;
                const relativeProfitMargin = profitMargin * weight; // = grossProfit_món / totalRevenue

                return {
                    foodId: f.foodId,
                    foodName: f.foodName,
                    revenue: f.revenue,
                    cost: f.cost,
                    grossProfit: f.grossProfit,
                    quantitySold: f.quantitySold,
                    profitMargin: parseFloat(profitMargin.toFixed(4)),
                    weight: parseFloat(weight.toFixed(4)),
                    relativeProfitMargin: parseFloat(relativeProfitMargin.toFixed(4))
                };
            });

            return res.json({
                period: { days, from, to },
                totalRevenue,
                totalGrossProfit,
                compositeMarginPercent,
                foods
            });

        } catch (error) {
            console.error("Error getting margin analytics:", error);
            return res.status(500).json({
                message: error.message || "Internal server error"
            });
        }
    }

    // =====================================================
    // 4. GIÁ TRỊ BILL TRUNG BÌNH
    //    GET /api/orders/avg-bill-value?days=7
    //
    //    avgBillValue = totalRevenue / billCount
    // =====================================================

    async getAvgBillValue(req, res) {
        try {
            const days = parseInt(req.query.days) || 30;

            if (!_validateDays(days)) {
                return res.status(400).json({
                    message: "days must be one of: 7, 14, 21, 30"
                });
            }

            const { from, to } = _getDateRange(days);

            const result = await Order.aggregate([
                {
                    $match: {
                        status: "COMPLETED",
                        createdAt: { $gte: from, $lte: to }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$totalAmount" },
                        billCount: { $sum: 1 }
                    }
                }
            ]);

            const data = result[0] ?? {
                totalRevenue: 0,
                billCount: 0
            };

            const avgBillValue =
                data.billCount > 0
                    ? Math.round(data.totalRevenue / data.billCount)
                    : 0;

            return res.json({
                period: { days, from, to },
                totalRevenue: data.totalRevenue,
                billCount: data.billCount,
                avgBillValue
            });

        } catch (error) {
            console.error("Error getting avg bill value:", error);
            return res.status(500).json({
                message: error.message || "Internal server error"
            });
        }
    }

}

module.exports = new AnalystController();