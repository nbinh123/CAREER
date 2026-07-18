import {
    BarChart, Bar, Cell,
    CartesianGrid, XAxis, YAxis, Tooltip,
    ResponsiveContainer,
} from "recharts";
import { BarChart2 } from "lucide-react";

import fmtVND from "../../utils/fmtVND";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import { fmtK, TIP } from "./helpers/mathHelpers";

/**
 * Chart02 — Doanh thu theo tuần / tháng
 *
 * Props:
 *   data  {Object}  — response từ API /weekly hoặc /monthly, có field .days
 *   tf    {string}  — "week" | "month"
 *   onTf  {Function} — callback đổi timeframe
 */
export default function Chart02({ data = {}, tf = "week", onTf }) {
    const chart = data?.days || [];
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
            <ChartHeader icon={BarChart2} iconColor="text-blue-500" title={`Doanh thu trong ${tf === "week" ? "tuần" : "tháng"}`}>
                <TabToggle
                    value={tf}
                    onChange={onTf}
                    options={[["week", "Tuần"], ["month", "Tháng"]]}
                />
            </ChartHeader>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eff6ff" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        interval={tf === "month" ? 4 : 0}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={fmtK}
                        width={46}
                    />
                    <Tooltip formatter={v => [fmtVND(v), "Doanh thu"]} contentStyle={TIP} />
                    <Bar dataKey="revenue" name="Doanh thu" radius={[4, 4, 0, 0]} barSize={tf === "week" ? 36 : 10}>
                        {chart.map((_, i) => (
                            <Cell key={i} fill={i % 2 === 0 ? "#60a5fa" : "#3b82f6"} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}
