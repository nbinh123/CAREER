import { useMemo } from "react";
import {
    ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { Users } from "lucide-react";

import fmtVND from "../../utils/fmtVND";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import { TIP, addEMA } from "./helpers/mathHelpers";

const bs = (tf, lg = 18, md = 14, sm = 7) =>
    tf === "day" ? lg : tf === "week" ? md : sm;

/**
 * Chart05 — Giá trị bill trung bình + EMA
 *
 * Props:
 * data      {Array}
 * tf        {string}   — "day" | "week" | "month"
 * emaPeriod {number}
 * onTf      {Function}
 * onEma     {Function}
 */
export default function Chart05({ data = [], tf = "day", emaPeriod = 5, onTf, onEma }) {
    const chart = useMemo(() => addEMA(data, "avgBill", emaPeriod), [data, emaPeriod]);

    // --- LOGIC TÍNH TOÁN TRỤC Y ---
    // 1. Tìm giá trị lớn nhất (so sánh cả avgBill và ema)
    const maxVal = chart.length > 0 
        ? Math.max(...chart.map(item => Math.max(item.avgBill || 0, item.ema || 0))) 
        : 0;

    // 2. Mốc cao nhất = max * 2
    const topTick = maxVal > 0 ? maxVal * 2 : 1000;

    // 3. Chia đều 5 mốc
    const customTicks = [
        0,
        topTick * 0.25,
        topTick * 0.5,
        topTick * 0.75,
        topTick
    ];

    // 4. Hàm Format Y-Axis
    const formatYAxis = (value) => {
        if (value === 0) return "0";
        
        if (value >= 1000000) {
            const valInM = value / 1000000;
            return Number.isInteger(valInM) ? `${valInM}M` : `${valInM.toFixed(1)}M`;
        } 
        
        if (value >= 1000) {
            return `${Math.round(value / 1000)}k`;
        }
        
        return value.toString();
    };

    return (
        <ChartCard>
            <ChartHeader icon={Users} iconColor="text-amber-500" title="Giá trị bill trung bình">
                <div className="flex items-center gap-2 flex-wrap">
                    <TabToggle
                        value={tf}
                        onChange={onTf}
                        options={[["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]]}
                    />
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                        <span className="text-xs text-amber-500 font-medium">EMA</span>
                        <input
                            type="number"
                            min="2"
                            max="30"
                            value={emaPeriod}
                            onChange={e => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v) && v >= 2) onEma(v);
                            }}
                            className="w-10 bg-transparent text-xs font-mono text-amber-700 text-center focus:outline-none"
                        />
                        <span className="text-xs text-amber-400">kỳ</span>
                    </div>
                </div>
            </ChartHeader>
            <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={chart} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fffbeb" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        interval={tf === "month" ? 4 : 0}
                    />
                    <YAxis
                        domain={[0, topTick]}
                        ticks={customTicks}
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                    />
                    <Tooltip formatter={v => fmtVND(v)} contentStyle={TIP} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="avgBill" name="Bill TB" fill="#fcd34d" radius={[4, 4, 0, 0]} barSize={bs(tf)} />
                    <Line
                        type="monotone"
                        dataKey="ema"
                        name={`EMA (${emaPeriod} kỳ trước)`}
                        stroke="#b45309"
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}