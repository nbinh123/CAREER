import { useState, useMemo } from "react";
import {
    ComposedChart, Bar, ReferenceLine,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { Package } from "lucide-react";

import ChartCard from "./sub_components/ChartCard";
import TabToggle from "./sub_components/TabToggle";
import { TIP, pidCalc, r1, } from "./helpers/mathHelpers";

import MiniSparkline from "../charts/sub_components/MiniSparkLine";
import { API_BASE } from "../charts/helpers/apiHelpers";

/**
 * Chart10 — PID Ingredient Planning
 *
 * Props:
 *   pidRows    {Array}    — từ API /pid
 *   tf         {string}   — "day" | "week"
 *   onTf       {Function}
 *   onRowsChange {Function} — (updatedRows) => void  (optimistic update bubble-up)
 */
export default function Chart10({ pidRows = [], tf = "day", onTf, onRowsChange }) {
    const [expandedRow, setExpandedRow] = useState(null);

    // ── PID summary bar chart ─────────────────────────────────────────────────
    const pidChartData = useMemo(() => pidRows.map(ing => {
        const hist = tf === "day" ? ing.dayHistory : ing.weekHistory;
        const exp  = tf === "day" ? ing.dayExpected : ing.weekExpected;
        const { pred } = pidCalc(hist || [], exp || 0, ing.Kp, ing.Ki, ing.Kd);
        const actual = hist?.length ? hist[hist.length - 1] : 0;
        return {
            name:         ing.name,
            actual:       Math.round(actual / (exp || 1) * 100),
            predicted:    Math.round(pred   / (exp || 1) * 100),
            actualRaw:    actual,
            predictedRaw: r1(pred),
            unit:         ing.unit,
        };
    }), [pidRows, tf]);

    // ── K param update ────────────────────────────────────────────────────────
    const updateK = async (idx, key, val) => {
        const ing     = pidRows[idx];
        const updated = { ...ing, [key]: parseFloat(val) || 0 };
        const newRows = pidRows.map((d, i) => i === idx ? updated : d);
        onRowsChange?.(newRows);                          // optimistic bubble-up
        try {
            await fetch(`${API_BASE}/pid/${ing.ingredientId}`, {
                method:  "PATCH",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ Kp: updated.Kp, Ki: updated.Ki, Kd: updated.Kd }),
            });
        } catch (err) {
            console.error("updateK failed:", err);
        }
    };

    return (
        <ChartCard>
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Package size={16} className="text-green-600" />
                    <h3 className="font-bold text-gray-700">Nguyên liệu cần chuẩn bị — PID Controller</h3>
                </div>
                <TabToggle
                    value={tf}
                    onChange={onTf}
                    options={[["day", "Hôm nay"], ["week", "Tuần này"]]}
                />
            </div>

            {/* ── Formula banner ── */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-5 text-xs text-amber-800 font-mono leading-5">
                <strong>Q<sub>dự đoán</sub> = Q<sub>kỳ trước</sub> + K<sub>p</sub>·e + K<sub>i</sub>·Σe + K<sub>d</sub>·Δe</strong>
                <span className="mx-2 text-amber-400">|</span>
                e = kỳ vọng − thực tế
                <span className="mx-2 text-amber-400">|</span>
                <span className="text-amber-600">─── lịch sử</span>
                <span className="mx-2">·</span>
                <span className="text-orange-500">- - - dự đoán</span>
            </div>

            {/* ── Summary bar chart ── */}
            <div className="mb-6">
                <p className="text-xs text-gray-400 mb-2 text-right">
                    Giá trị theo % kỳ vọng | 100% = đúng kỳ vọng
                </p>
                <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={pidChartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: "#4b5563" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={n => n.split(" ").pop()}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => `${v}%`}
                            width={38}
                        />
                        <Tooltip
                            formatter={(v, n, props) => {
                                const d   = props.payload;
                                const raw = n === "actual" ? d.actualRaw : d.predictedRaw;
                                return [`${v}% (${raw} ${d.unit})`, n === "actual" ? "Kỳ này" : "PID dự đoán"];
                            }}
                            contentStyle={TIP}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        <ReferenceLine
                            y={100}
                            stroke="#22c55e"
                            strokeDasharray="5 3"
                            strokeWidth={1}
                            label={{ value: "Kỳ vọng", position: "insideTopRight", fontSize: 10, fill: "#16a34a" }}
                        />
                        <Bar dataKey="actual"    name="actual"    fill="#93c5fd" radius={[3, 3, 0, 0]} barSize={18} />
                        <Bar
                            dataKey="predicted"
                            name="predicted"
                            fill="#f97316"
                            radius={[3, 3, 0, 0]}
                            barSize={18}
                            label={{ position: "top", fontSize: 9, fill: "#f97316", formatter: v => `${v}%` }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* ── Ingredient cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {pidRows.map((ing, idx) => {
                    const hist  = tf === "day" ? ing.dayHistory : ing.weekHistory;
                    const exp   = tf === "day" ? ing.dayExpected : ing.weekExpected;
                    const { pred, pTerm, iTerm, dTerm, e } = pidCalc(hist, exp, ing.Kp, ing.Ki, ing.Kd);
                    const predR   = r1(pred);
                    const lastAct = hist[hist.length - 1];
                    const delta   = r1(pred - lastAct);
                    const isExpand = expandedRow === idx;

                    const statusColor = Math.abs(delta / lastAct) < 0.03
                        ? "bg-gray-100 text-gray-500"
                        : delta > 0 ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600";
                    const statusLabel = Math.abs(delta / lastAct) < 0.03
                        ? "Ổn định"
                        : delta > 0 ? `+${r1(delta)} ${ing.unit}` : `${r1(delta)} ${ing.unit}`;

                    return (
                        <div
                            key={idx}
                            className="border border-gray-100 rounded-xl overflow-hidden hover:border-green-200 transition-colors"
                        >
                            {/* Card header */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                                <div>
                                    <span className="font-bold text-gray-800 text-sm">{ing.name}</span>
                                    <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                        {ing.unit}
                                    </span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                                    {statusLabel}
                                </span>
                            </div>

                            {/* Sparkline + summary */}
                            <div className="flex items-center gap-3 px-4 pb-3">
                                <MiniSparkline data={hist} predicted={predR} color="#22c55e" w={110} h={40} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between text-xs mb-0.5">
                                        <span className="text-gray-400">Kỳ trước</span>
                                        <span className="font-mono text-gray-700">{lastAct} {ing.unit}</span>
                                    </div>
                                    <div className="flex justify-between text-xs mb-0.5">
                                        <span className="text-gray-400">Kỳ vọng</span>
                                        <span className="font-mono text-gray-500">{exp} {ing.unit}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-orange-500 font-semibold">PID dự đoán</span>
                                        <span className="font-mono font-black text-orange-600">{predR} {ing.unit}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expand toggle */}
                            <button
                                onClick={() => setExpandedRow(isExpand ? null : idx)}
                                className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 hover:bg-green-50 transition-colors"
                            >
                                <span>Chỉnh thông số K — Kp={ing.Kp} · Ki={ing.Ki} · Kd={ing.Kd}</span>
                                <span>{isExpand ? "▲" : "▼"}</span>
                            </button>

                            {/* Expanded K params */}
                            {isExpand && (
                                <div className="px-4 pb-4 pt-3 bg-gray-50 border-t border-gray-100 space-y-3">
                                    {[
                                        ["Kp", "Proportional", "0.01", "1",   "#22c55e"],
                                        ["Ki", "Integral",     "0.01", "0.5", "#60a5fa"],
                                        ["Kd", "Derivative",   "0.01", "0.3", "#f59e0b"],
                                    ].map(([k, label, step, max, color]) => (
                                        <div key={k}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-mono font-semibold" style={{ color }}>{k}</span>
                                                <span className="text-gray-500">{label}</span>
                                                <span className="font-mono text-gray-700">{ing[k]}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max={max}
                                                step={step}
                                                value={ing[k]}
                                                onChange={e => updateK(idx, k, e.target.value)}
                                                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-green-500"
                                            />
                                        </div>
                                    ))}

                                    {/* PID breakdown */}
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">
                                            Phân tích PID
                                        </p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                            <span className="text-gray-400">e (lỗi kỳ này)</span>
                                            <span className={`font-mono text-right ${e >= 0 ? "text-orange-500" : "text-green-600"}`}>
                                                {r1(e)} {ing.unit}
                                            </span>
                                            <span className="text-gray-400">P = Kp·e</span>
                                            <span className="font-mono text-right text-blue-600">{r1(pTerm)}</span>
                                            <span className="text-gray-400">I = Ki·Σe</span>
                                            <span className="font-mono text-right text-blue-600">{r1(iTerm)}</span>
                                            <span className="text-gray-400">D = Kd·Δe</span>
                                            <span className="font-mono text-right text-blue-600">{r1(dTerm)}</span>
                                            <span className="text-gray-600 font-bold border-t border-gray-200 pt-1">
                                                Dự đoán kỳ sau
                                            </span>
                                            <span className="font-mono font-black text-orange-600 border-t border-gray-200 pt-1 text-right">
                                                {predR} {ing.unit}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Bottom legend ── */}
            <div className="flex gap-6 mt-5 pt-4 border-t border-gray-100 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-0.5 bg-green-400 rounded inline-block" />
                    <span>Lịch sử tiêu thụ</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 border-t-2 border-dashed border-orange-400 inline-block" />
                    <span>Dự đoán PID (kỳ tiếp theo)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                    <span>Điểm dự đoán</span>
                </div>
            </div>
        </ChartCard>
    );
}
