import { useMemo, useState } from "react";
import {
    ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
    ReferenceLine, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Target, ArrowUp } from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtVND(v) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

function fmtShort(v) {
    const a = Math.abs(v);
    const s = v < 0 ? "-" : "";
    if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(1)}M`;
    if (a >= 1_000) return `${s}${Math.round(a / 1_000)}k`;
    return v.toString();
}

const TICK_OPTIONS = [4, 5, 6, 8, 10];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val = payload[0]?.value;
    return (
        <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 10, padding: "8px 12px", fontSize: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
        }}>
            <p style={{ color: "#9ca3af", marginBottom: 3, marginTop: 0 }}>Ngày {label}</p>
            <p style={{ fontWeight: 700, color: "#111827", margin: 0 }}>{fmtVND(val)}</p>
        </div>
    );
};

// ─── Chart07 ──────────────────────────────────────────────────────────────────
/**
 * Props:
 *  data           {Array}    — [{ day, profit, cumulativeProfit }]
 *  breakeven      {number}   — giá trị hòa vốn (controlled)
 *  breakevenInput {string}   — string raw input (controlled)
 *  onBreakeven    {Function} — (numVal, strVal) => void
 *
 * Khi không truyền onBreakeven, component tự quản lý state breakeven nội bộ.
 */
export default function Chart07({
    data = [],
    breakeven: externalBe,
    breakevenInput: externalBeInput,
    onBreakeven,
}) {
    const [localBe, setLocalBe] = useState(300000);
    const [localBeStr, setLocalBeStr] = useState("300000");
    const [tickCount, setTickCount] = useState(6);

    // controlled vs uncontrolled
    const be = externalBe ?? localBe;
    const beInputV = externalBeInput ?? localBeStr;

    const handleBeChange = (str) => {
        const v = parseInt(str);
        if (onBreakeven) {
            onBreakeven(isNaN(v) ? be : v, str);
        } else {
            setLocalBeStr(str);
            if (!isNaN(v) && v > 0) setLocalBe(v);
        }
    };

    // ── Chuẩn hoá dữ liệu: ngày 31 → ngày 1, lấp đầy 1-30 ──
    const chartData = useMemo(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const filled = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const found = data.find(d => d.day === day);
            return found ? { ...found, day } : { day, cumulativeProfit: null };
        });

        const lastDayWithData = filled.reduce(
            (acc, d) => (d.cumulativeProfit !== null ? d.day : acc),
            null
        );
        let lastVal = null;
        return filled.map(d => {
            if (d.cumulativeProfit !== null) {
                lastVal = d.cumulativeProfit;
                return d;
            }
            if (lastVal !== null && d.day <= lastDayWithData) {
                return { ...d, cumulativeProfit: lastVal };
            }
            return d; // null — chưa vẽ (ngày tương lai)
        });
    }, [data]);

    // ── Thống kê ──
    const validProfits = chartData
        .map(d => d.cumulativeProfit)
        .filter(v => v !== null && v !== undefined);
    const maxProfit = validProfits.length ? Math.max(...validProfits) : 0;
    const minProfit = validProfits.length ? Math.min(...validProfits, 0) : 0;
    const latestProfit = validProfits.length ? validProfits[validProfits.length - 1] : 0;
    const exceeded = latestProfit >= be;
    const progress = Math.min(100, Math.max(0, be > 0 ? (latestProfit / be) * 100 : 0));
    const remaining = be - latestProfit;

    // ── Domain trục Y ──
    // Nếu maxProfit > điểm hòa vốn → tick cao nhất = maxProfit * 2
    // Ngược lại → tick cao nhất = breakeven * 2
    const topTick = maxProfit > be ? maxProfit * 2 : be * 2;

    let bottomTick = 0;
    if (minProfit < 0) {
        const rawStep = topTick / tickCount;
        bottomTick = Math.floor(minProfit / rawStep) * rawStep;
    }

    const totalRange = topTick - bottomTick;
    const step = totalRange / tickCount;
    const customTicks = Array.from({ length: tickCount + 1 }, (_, i) => bottomTick + i * step);

    // % từ đỉnh biểu đồ nơi đường hòa vốn nằm (cho linearGradient SVG)
    const beFrac = totalRange === 0 ? 0.5 : (be - bottomTick) / totalRange;
    const beStop = Math.max(0, Math.min(100, (1 - beFrac) * 100)).toFixed(2);

    return (
        <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden select-none"
            style={{ fontFamily: "inherit" }}
        >
            {/* ══ HEADER ══════════════════════════════════════════════════════ */}
            <div className="px-5 pt-5 pb-4">

                {/* Row: tiêu đề + input hòa vốn */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    {/* Trái: icon + profit */}
                    <div className="flex items-center gap-3">
                        <span
                            className="flex items-center justify-center rounded-xl bg-green-50 flex-shrink-0"
                            style={{ width: 34, height: 34 }}
                        >
                            <TrendingUp size={15} className="text-green-600" />
                        </span>
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                                Lợi nhuận tích lũy
                            </p>
                            <p
                                className="font-bold leading-none"
                                style={{
                                    fontSize: 22,
                                    color: exceeded ? "#16a34a" : "#111827",
                                }}
                            >
                                {fmtVND(latestProfit)}
                            </p>
                        </div>
                    </div>

                    {/* Phải: breakeven input */}
                    <div
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 flex-shrink-0"
                        style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}
                    >
                        <Target size={12} style={{ color: "#f97316" }} />
                        <label className="text-xs font-medium whitespace-nowrap" style={{ color: "#f97316" }}>
                            Hòa vốn
                        </label>
                        <input
                            type="number"
                            value={beInputV}
                            onChange={e => handleBeChange(e.target.value)}
                            style={{
                                width: 90,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                fontSize: 12,
                                fontFamily: "monospace",
                                fontWeight: 600,
                                color: "#ea580c",
                                textAlign: "right",
                            }}
                        />
                    </div>
                </div>

                {/* ── Thanh tiến trình ── */}
                <div>
                    {/* Label + % */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-400">Tiến trình hòa vốn</span>
                        <div className="flex items-center gap-2">
                            {exceeded && (
                                <span
                                    className="flex items-center gap-1 text-green-700 font-bold rounded-full px-2"
                                    style={{ fontSize: 10, background: "#dcfce7", paddingTop: 2, paddingBottom: 2 }}
                                >
                                    <ArrowUp size={9} />
                                    Đã vượt
                                </span>
                            )}
                            <span
                                className="font-bold"
                                style={{ fontSize: 14, color: exceeded ? "#16a34a" : "#f97316" }}
                            >
                                {progress.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Track */}
                    <div
                        className="rounded-full overflow-hidden"
                        style={{ height: 8, background: "#f3f4f6" }}
                    >
                        <div
                            className="rounded-full"
                            style={{
                                height: "100%",
                                width: `${progress}%`,
                                transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                                background: exceeded
                                    ? "linear-gradient(90deg, #86efac, #22c55e)"
                                    : "linear-gradient(90deg, #fca5a5, #fb923c)",
                            }}
                        />
                    </div>

                    {/* Nhãn dưới thanh */}
                    <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-300">₫0</span>
                        {exceeded ? (
                            <span className="text-xs font-medium" style={{ color: "#16a34a" }}>
                                +{fmtVND(Math.abs(remaining))} vượt mục tiêu
                            </span>
                        ) : (
                            <span className="text-xs" style={{ color: "#fdba74" }}>
                                Còn {fmtVND(remaining)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ══ TICK SELECTOR ═══════════════════════════════════════════════ */}
            <div
                className="flex items-center gap-2 px-5 py-2"
                style={{ borderTop: "1px solid #f9fafb", borderBottom: "1px solid #f9fafb" }}
            >
                <span className="text-xs font-medium text-gray-400" style={{ marginRight: 4 }}>
                    Số tick:
                </span>
                {TICK_OPTIONS.map(n => (
                    <button
                        key={n}
                        onClick={() => setTickCount(n)}
                        style={{
                            minWidth: 28,
                            height: 24,
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            border: tickCount === n ? "1px solid #bbf7d0" : "1px solid #f3f4f6",
                            background: tickCount === n ? "#dcfce7" : "transparent",
                            color: tickCount === n ? "#15803d" : "#9ca3af",
                        }}
                    >
                        {n}
                    </button>
                ))}
            </div>

            {/* ══ CHART ════════════════════════════════════════════════════════ */}
            <div style={{ padding: "12px 8px 8px 8px" }}>
                <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                    >
                        <defs>
                            {/* Gradient đổi màu tại điểm hòa vốn */}
                            <linearGradient id="cpGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" />
                                <stop offset={`${beStop}%`} stopColor="#22c55e" />
                                <stop offset={`${beStop}%`} stopColor="#ef4444" />
                                <stop offset="100%" stopColor="#ef4444" />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f3f4f6"
                            vertical={false}
                        />

                        <XAxis
                            dataKey="day"
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => `Ng.${v}`}
                            ticks={[1, 5, 10, 15, 20, 25, 30]}
                        />

                        <YAxis
                            domain={[bottomTick, topTick]}
                            ticks={customTicks}
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={fmtShort}
                            width={46}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        {/* Đường hòa vốn */}
                        <ReferenceLine
                            y={be}
                            stroke="#f97316"
                            strokeDasharray="6 4"
                            strokeWidth={1.5}
                            label={{
                                value: "Hòa vốn",
                                position: "insideTopRight",
                                fontSize: 10,
                                fill: "#f97316",
                                fontWeight: 700,
                            }}
                        />

                        {/* Đường lợi nhuận tích lũy */}
                        <Line
                            type="monotone"
                            dataKey="cumulativeProfit"
                            stroke="url(#cpGrad)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, fill: "#0ea5e9", strokeWidth: 0 }}
                            connectNulls={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* ══ LEGEND ═══════════════════════════════════════════════════════ */}
            <div
                className="flex gap-5 pb-4 pt-3 justify-center flex-wrap"
                style={{ borderTop: "1px solid #f9fafb" }}
            >
                {[
                    { color: "#22c55e", label: "Vượt hòa vốn" },
                    { color: "#ef4444", label: "Chưa đạt hòa vốn" },
                    { color: "#f97316", dashed: true, label: "Điểm hòa vốn" },
                ].map(({ color, dashed, label }) => (
                    <span
                        key={label}
                        className="flex items-center gap-1.5 text-xs text-gray-400"
                    >
                        {dashed ? (
                            <span style={{
                                display: "inline-block",
                                width: 20,
                                borderTop: `2px dashed ${color}`,
                            }} />
                        ) : (
                            <span style={{
                                display: "inline-block",
                                width: 20, height: 2,
                                background: color,
                                borderRadius: 999,
                            }} />
                        )}
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}