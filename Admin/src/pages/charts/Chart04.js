import { useMemo } from "react";
import {
    ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { ShoppingCart } from "lucide-react";

import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import { TIP, addEMA } from "./helpers/mathHelpers";

const bs = (tf, lg = 18, md = 14, sm = 7) =>
    tf === "day" ? lg : tf === "week" ? md : sm;

/**
 * Chart04 — Số lượng bill theo giờ/tuần/tháng + EMA
 *
 * Props:
 * data      {Array}
 * tf        {string}   — "day" | "week" | "month"
 * emaPeriod {number}
 * onTf      {Function}
 * onEma     {Function}
 */
export default function Chart04({ data = [], tf = "day", emaPeriod = 5, onTf, onEma }) {
    const chart = useMemo(() => addEMA(data, "bills", emaPeriod), [data, emaPeriod]);

    // --- LOGIC TÍNH TOÁN TRỤC Y ---
    // 1. Tìm giá trị lớn nhất (so sánh cả bills và ema)
    const maxVal = chart.length > 0 
        ? Math.max(...chart.map(item => Math.max(item.bills || 0, item.ema || 0))) 
        : 0;

    // 2. Mốc cao nhất = max * 2 (nếu max = 0 thì gán tạm 10)
    const topTick = maxVal > 0 ? maxVal * 2 : 10;

    // 3. Chia đều 5 mốc và làm tròn lên thành số nguyên (vì bill không thể là số thập phân)
    const customTicks = [
        0,
        Math.ceil(topTick * 0.25),
        Math.ceil(topTick * 0.5),
        Math.ceil(topTick * 0.75),
        Math.ceil(topTick)
    ];

    // 4. Hàm Format Y-Axis
    const formatYAxis = (value) => {
        if (value === 0) return "0";
        
        if (value >= 1000000) {
            const valInM = value / 1000000;
            return Number.isInteger(valInM) ? `${valInM}M` : `${valInM.toFixed(1)}M`;
        } 
        
        // Từ 1000 đến dưới 1 triệu: hiển thị dạng k
        if (value >= 1000) {
            return `${Math.round(value / 1000)}k`;
        }
        
        // Dưới 1000: giữ nguyên số để không bị lỗi 0k
        return value.toString();
    };

    return (
        <ChartCard>
            <ChartHeader icon={ShoppingCart} iconColor="text-sky-500" title="Số lượng bill">
                <div className="flex items-center gap-2 flex-wrap">
                    <TabToggle
                        value={tf}
                        onChange={onTf}
                        options={[["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]]}
                    />
                    <div className="flex items-center gap-1 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1">
                        <span className="text-xs text-sky-500 font-medium">EMA</span>
                        <input
                            type="number"
                            min="2"
                            max="30"
                            value={emaPeriod}
                            onChange={e => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v) && v >= 2) onEma(v);
                            }}
                            className="w-10 bg-transparent text-xs font-mono text-sky-700 text-center focus:outline-none"
                        />
                        <span className="text-xs text-sky-400">kỳ</span>
                    </div>
                </div>
            </ChartHeader>
            <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={chart} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f9ff" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        interval={tf === "month" ? 4 : 0}
                    />
                    <YAxis
                        domain={[0, customTicks[4]]} // Fix domain bằng mốc tick lớn nhất
                        ticks={customTicks}
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={36} // Tăng width một chút (từ 28 lên 36) để text tick có thêm không gian nếu số lên hàng nghìn
                    />
                    <Tooltip
                        contentStyle={TIP}
                        formatter={(v, n) => [v, n.startsWith("EMA") ? n : "Số bill"]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="bills" name="Số bill" fill="#7dd3fc" radius={[4, 4, 0, 0]} barSize={bs(tf)} />
                    <Line
                        type="monotone"
                        dataKey="ema"
                        name={`EMA (${emaPeriod} kỳ trước)`}
                        stroke="#0369a1"
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}