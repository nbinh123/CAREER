import {
    ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

import fmtVND from "../../utils/fmtVND";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import { TIP } from "./helpers/mathHelpers";

const bs = (tf, lg = 18, md = 14, sm = 7) =>
    tf === "day" ? lg : tf === "week" ? md : sm;

/**
 * Chart06 — Doanh thu & Chi phí & Lợi nhuận — Cột ghép + Đường
 *
 * Props:
 * data  {Array}
 * tf    {string}   — "day" | "week" | "month"
 * onTf  {Function}
 */
export default function Chart06({ data = [], tf = "week", onTf }) {
    // --- LOGIC TÍNH TOÁN TRỤC Y ---
    // 1. Tìm giá trị lớn nhất trong cả revenue, cost và profit
    const maxVal = data.length > 0 
        ? Math.max(...data.map(item => Math.max(item.revenue || 0, item.cost || 0, item.profit || 0))) 
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
            <ChartHeader
                icon={TrendingUp}
                iconColor="text-rose-500"
                title="Doanh thu & Chi phí & Lợi nhuận"
            >
                <TabToggle
                    value={tf}
                    onChange={onTf}
                    options={[["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]]}
                />
            </ChartHeader>
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        interval={tf === "month" ? 4 : 0}
                    />
                    {/* Trục Y Trái - Dành cho Doanh Thu & Chi Phí */}
                    <YAxis
                        yAxisId="bar"
                        domain={[0, topTick]}
                        ticks={customTicks}
                        tickFormatter={formatYAxis}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                    />
                    {/* Trục Y Phải - Dành cho Lợi Nhuận */}
                    <YAxis
                        yAxisId="line"
                        orientation="right"
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
                            n === "revenue" ? "Doanh thu" : n === "cost" ? "Chi phí" : "Lợi nhuận",
                        ]}
                        contentStyle={TIP}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="bar" dataKey="revenue" name="revenue" fill="#4ade80" radius={[3, 3, 0, 0]} barSize={bs(tf)} />
                    <Bar yAxisId="bar" dataKey="cost" name="cost" fill="#fca5a5" radius={[3, 3, 0, 0]} barSize={bs(tf)} />
                    <Line
                        yAxisId="line"
                        type="monotone"
                        dataKey="profit"
                        name="profit"
                        stroke="#0891b2"
                        strokeWidth={2.5}
                        dot={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}