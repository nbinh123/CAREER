import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { Flame, BarChart2 } from "lucide-react";

import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import PieLabel from "./sub_components/PieLabel";
import { TIP, PIE_COLORS, DAYS_VN, heatColor, } from "./helpers/mathHelpers";
/**
 * Chart09 — Top 5 món bán chạy (Pie) + Heatmap doanh thu
 *
 * Props:
 *   pieData     {Array}    — từ API /top-dishes
 *   heatmapData {Array}    — từ API /heatmap  (7 rows × 15 cols)
 *   tfPie       {string}   — "day" | "week"
 *   onTfPie     {Function}
 */
export default function Chart09({ pieData = [], heatmapData = [], tfPie = "day", onTfPie }) {
    const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Pie chart ── */}
            <ChartCard>
                <ChartHeader icon={Flame} iconColor="text-orange-500" title="Top 5 món bán chạy">
                    <TabToggle
                        value={tfPie}
                        onChange={onTfPie}
                        options={[["day", "Hôm nay"], ["week", "Tuần này"]]}
                    />
                </ChartHeader>
                <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={230}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                innerRadius={52}
                                outerRadius={90}
                                labelLine={false}
                                label={PieLabel}
                                paddingAngle={2}
                            >
                                {pieData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(v, n) => [
                                    `${v} món (${(v / (pieTotal || 1) * 100).toFixed(1)}%)`,
                                    n,
                                ]}
                                contentStyle={TIP}
                            />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Custom legend */}
                    <div className="w-full grid grid-cols-2 gap-x-6 gap-y-1.5 mt-1 px-2">
                        {pieData.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 min-w-0">
                                <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                <span className="text-xs text-gray-600 truncate flex-1">{d.name}</span>
                                <span className="text-xs font-mono text-gray-400 flex-shrink-0">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </ChartCard>

            {/* ── Heatmap ── */}
            <ChartCard>
                <ChartHeader
                    icon={BarChart2}
                    iconColor="text-purple-500"
                    title="Heatmap doanh thu — giờ × ngày"
                />
                <div className="overflow-x-auto">
                    <div style={{ minWidth: 460 }}>
                        {/* Hour labels */}
                        <div className="flex gap-1 ml-8 mb-1">
                            {Array.from({ length: 15 }, (_, i) => (
                                <div
                                    key={i}
                                    className="text-center text-xs text-gray-400 font-medium"
                                    style={{ width: 26 }}
                                >
                                    {i + 7}h
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {heatmapData.map((row, di) => (
                            <div key={di} className="flex items-center gap-1 mb-1">
                                <div
                                    className="text-xs text-gray-500 font-bold text-right mr-1"
                                    style={{ width: 24 }}
                                >
                                    {DAYS_VN[di]}
                                </div>
                                {row.map((cell, hi) => (
                                    <div
                                        key={hi}
                                        title={`${DAYS_VN[di]} ${cell.hour}h: ${cell.val}`}
                                        style={{
                                            backgroundColor: heatColor(cell.val),
                                            width: 26,
                                            height: 22,
                                            borderRadius: 5,
                                            flexShrink: 0,
                                        }}
                                    />
                                ))}
                            </div>
                        ))}

                        {/* Scale */}
                        <div className="flex items-center gap-2 mt-3 ml-8">
                            <span className="text-xs text-gray-400">Thấp</span>
                            {["#f0fdf4", "#bbf7d0", "#4ade80", "#22c55e", "#15803d"].map(c => (
                                <div
                                    key={c}
                                    style={{ backgroundColor: c, width: 18, height: 12, borderRadius: 3 }}
                                />
                            ))}
                            <span className="text-xs text-gray-400">Cao</span>
                        </div>
                    </div>
                </div>
            </ChartCard>
        </div>
    );
}
