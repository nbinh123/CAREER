import { useMemo } from "react";
import {
    ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { Calendar } from "lucide-react";
import fmtVND from "../../utils/fmtVND";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
// Vẫn import TIP và addMA, có thể bạn không cần fmtM ở đây nữa nhưng cứ giữ nguyên import để tránh lỗi
import { TIP, addMA } from "./helpers/mathHelpers";

/**
 * Chart03 — Doanh thu theo khoảng thời gian + Moving Average
 *
 * Props:
 * data       {Array}    — raw data từ API /range
 * dateFrom   {string}   — "YYYY-MM-DD"
 * dateTo     {string}   — "YYYY-MM-DD"
 * maPeriod   {number}   — số kỳ MA
 * onDateFrom {Function}
 * onDateTo   {Function}
 * onMaPeriod {Function}
 */
export default function Chart03({
    data = [],
    dateFrom,
    dateTo,
    maPeriod = 7,
    onDateFrom,
    onDateTo,
    onMaPeriod,
}) {
    const chart = useMemo(() => {
        if (!data.length) return [];
        return addMA(data, "revenue", maPeriod);
    }, [data, maPeriod]);

    const c3Interval = Math.max(0, Math.floor(chart.length / 9) - 1);

    // --- LOGIC TÍNH TOÁN TRỤC Y ---
    // 1. Tìm giá trị lớn nhất (so sánh cả revenue và ma để không bị lẹm chart)
    const maxVal = chart.length > 0 
        ? Math.max(...chart.map(item => Math.max(item.revenue || 0, item.ma || 0))) 
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
        
        if (value < 1000000 && value > 0) {
            return `${Math.round(value / 1000)}k`;
        }
        
        return value.toString();
    };

    return (
        <ChartCard>
            <ChartHeader
                icon={Calendar}
                iconColor="text-purple-500"
                title="Doanh thu theo khoảng thời gian"
            >
                <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-gray-500 font-medium">Từ</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => onDateFrom(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                    <label className="text-xs text-gray-500 font-medium">Đến</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => onDateTo(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                    {chart.length > 0 && (
                        <span className="text-xs text-gray-400">{chart.length} ngày</span>
                    )}
                    <div className="flex items-center gap-1 ml-1 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1">
                        <span className="text-xs text-purple-500 font-medium">MA</span>
                        <input
                            type="number"
                            min="2"
                            max="60"
                            value={maPeriod}
                            onChange={e => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v) && v >= 2) onMaPeriod(v);
                            }}
                            className="w-10 bg-transparent text-xs font-mono text-purple-700 text-center focus:outline-none"
                        />
                        <span className="text-xs text-purple-400">kỳ</span>
                    </div>
                </div>
            </ChartHeader>

            {chart.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">Chọn khoảng thời gian hợp lệ</p>
            ) : (
                <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f3ff" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false}
                            tickLine={false}
                            interval={c3Interval}
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
                        <Tooltip
                            formatter={(v, n) => [
                                fmtVND(v),
                                n === "revenue" ? "Doanh thu" : `MA (${maPeriod} kỳ trước)`,
                            ]}
                            contentStyle={TIP}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                            dataKey="revenue"
                            name="Doanh thu"
                            fill="#c4b5fd"
                            radius={[4, 4, 0, 0]}
                            barSize={Math.max(3, Math.min(18, Math.floor(600 / chart.length)))}
                        />
                        <Line
                            type="monotone"
                            dataKey="ma"
                            name={`MA (${maPeriod} kỳ trước)`}
                            stroke="#7c3aed"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}