import {
    ComposedChart, Bar, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer,
} from "recharts";
import { Clock } from "lucide-react";

import fmtVND from "../../utils/fmtVND";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import { TIP } from "./helpers/mathHelpers";

/**
 * Chart08 — Lượt khách & Giá trị bill trung bình — Cột + Đường
 *
 * Props:
 * data  {Array}
 * tf    {string}   — "hour" | "day"
 * onTf  {Function}
 */
export default function Chart08({ data = [], tf = "hour", onTf }) {
    // --- LOGIC TÍNH TOÁN TRỤC Y ---
    // 1. Tìm Max cho từng loại dữ liệu
    const maxBills = data.length > 0 ? Math.max(...data.map(item => item.bills || 0)) : 0;
    const maxAvgBill = data.length > 0 ? Math.max(...data.map(item => item.avgBill || 0)) : 0;

    // 2. Mốc cao nhất cho từng trục (x2 max hiện tại)
    const topTickBills = maxBills > 0 ? maxBills * 2 : 10;
    const topTickAvgBill = maxAvgBill > 0 ? maxAvgBill * 2 : 1000;

    // 3. Tạo 5 mốc cho trục Trái (Số lượng - Dùng Math.ceil để luôn là số nguyên)
    const ticksBills = [
        0,
        Math.ceil(topTickBills * 0.25),
        Math.ceil(topTickBills * 0.5),
        Math.ceil(topTickBills * 0.75),
        Math.ceil(topTickBills)
    ];

    // 4. Tạo 5 mốc cho trục Phải (Tiền tệ)
    const ticksAvgBill = [
        0,
        topTickAvgBill * 0.25,
        topTickAvgBill * 0.5,
        topTickAvgBill * 0.75,
        topTickAvgBill
    ];

    // 5. Các hàm Format Y-Axis
    const formatBills = (value) => {
        if (value === 0) return "0";
        if (value >= 1000) return `${Math.round(value / 1000)}k`;
        return value.toString();
    };

    const formatMoney = (value) => {
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
                icon={Clock}
                iconColor="text-indigo-500"
                title="Lượt khách & Giá trị bill trung bình"
            >
                <TabToggle
                    value={tf}
                    onChange={onTf}
                    options={[["hour", "Theo giờ"], ["day", "Theo ngày"]]}
                />
            </ChartHeader>
            <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                    />
                    {/* TRỤC Y TRÁI: Số lượng bill */}
                    <YAxis
                        yAxisId="ct"
                        domain={[0, ticksBills[4]]}
                        ticks={ticksBills}
                        tickFormatter={formatBills}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        label={{
                            value: "Lượt",
                            angle: -90,
                            position: "insideLeft",
                            offset: 10,
                            style: { fontSize: 10, fill: "#c7d2fe" },
                        }}
                    />
                    {/* TRỤC Y PHẢI: Bill Trung Bình */}
                    <YAxis
                        yAxisId="ab"
                        orientation="right"
                        domain={[0, ticksAvgBill[4]]}
                        ticks={ticksAvgBill}
                        tickFormatter={formatMoney}
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                        label={{
                            value: "Bill TB",
                            angle: 90,
                            position: "insideRight",
                            offset: 10,
                            style: { fontSize: 10, fill: "#fbbf24" },
                        }}
                    />
                    <Tooltip
                        formatter={(v, n) =>
                            n === "bills" ? [v, "Lượt khách"] : [fmtVND(v), "Bill TB"]
                        }
                        contentStyle={TIP}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                        yAxisId="ct"
                        dataKey="bills"
                        name="bills"
                        fill="#a5b4fc"
                        radius={[4, 4, 0, 0]}
                        barSize={tf === "hour" ? 22 : 28}
                    />
                    <Line
                        yAxisId="ab"
                        type="monotone"
                        dataKey="avgBill"
                        name="avgBill"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}