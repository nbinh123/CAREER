import { useMemo } from "react";
import {
    ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { DollarSign } from "lucide-react";
import fmtVND from "../../utils/fmtVND";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import { addEMA, fmtK, TIP } from "./helpers/mathHelpers";

/**
 * Chart01 — Doanh thu theo giờ trong ngày + EMA
 *
 * Props:
 *   data      {Array}  — raw chart data từ API /chart-data?tf=day
 *   emaPeriod {number} — số kỳ EMA (mặc định 5, được quản lý ở AnalystPage)
 */
export default function Chart01({ data = [], emaPeriod = 5 }) {
    const chart = useMemo(() => addEMA(data, "revenue", emaPeriod), [data, emaPeriod]);
    // 1. Tìm doanh thu lớn nhất, dự phòng giá trị 0 nếu data trống
    const maxRevenue = chart && chart.length > 0
        ? Math.max(...chart.map(item => item.revenue || 0))
        : 0;
    const high = 1.5;
    // 2. Đặt tick cao nhất = maxRevenue * 2 (nếu max = 0 thì gán tạm 1000 để chart không bị lỗi)
    const topTick = maxRevenue > 0 ? maxRevenue * high : 1000;

    // 3. Tạo mảng chia đều 5 mốc (0, 25%, 50%, 75%, 100%)
    const customTicks = [
        0,
        topTick * 0.25,
        topTick * 0.5,
        topTick * 0.75,
        topTick
    ];
    
    return (
        <ChartCard>
            <ChartHeader
                icon={DollarSign}
                iconColor="text-green-500"
                title="Doanh thu theo giờ trong ngày"
            />
            <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        domain={[0, topTick]}
                        ticks={customTicks}
                        tickFormatter={fmtK}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                    />
                    <Tooltip
                        formatter={(v, n) => [fmtVND(v), n === "revenue" ? "Doanh thu" : "EMA"]}
                        contentStyle={TIP}
                        labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                        dataKey="revenue"
                        name="Doanh thu"
                        fill="#86efac"
                        radius={[4, 4, 0, 0]}
                        barSize={22}
                    />
                    <Line
                        type="monotone"
                        dataKey="ema"
                        name="EMA (5)"
                        stroke="#15803d"
                        strokeWidth={2.5}
                        dot={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}