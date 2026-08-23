// src/pages/charts/Chart06.js
// [UI] Chuyển từ Chart06.js gốc. Bản gốc dùng 2 YAxis (yAxisId="bar"/"line")
// nhưng CÙNG domain/ticks [0, topTick] — thực chất chỉ là 1 trục, chỉ khác
// nhãn 2 bên — nên BarLineChart chỉ cần 1 barAxis, không cần lineAxis riêng
// (khác với Chart08 — 2 trục thực sự khác thang đo).
//
// [SUA — tối ưu hiệu suất, đợt 2] React.memo + useMemo cho bars/lines/barAxis
// + TF_OPTIONS hoist module scope (xem ghi chú ở Chart01/02.js).
import React, { useMemo } from "react";
import { View } from "react-native";
import { TrendingUp } from "lucide-react-native";
import fmtVND from "../../utils/fmtVND";
import { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import BarLineChart from "./sub_components/BarLineChart";
import { fmtAxisMoney } from "./helpers/mathHelpers";

const TF_OPTIONS = [
  ["day", "Ngày"],
  ["week", "Tuần"],
  ["month", "Tháng"],
];

function Chart06({ data: rawData = [], tf = "week", onTf }) {
  const data = Array.isArray(rawData) ? rawData : [];
  const maxVal = data.length > 0 ? Math.max(...data.map((item) => Math.max(item.revenue || 0, item.cost || 0, item.profit || 0))) : 0;
  const topTick = maxVal > 0 ? maxVal * 2 : 1000;
  const customTicks = useMemo(() => [0, topTick * 0.25, topTick * 0.5, topTick * 0.75, topTick], [topTick]);

  const bars = useMemo(
    () => [
      { key: "revenue", name: "Doanh thu", color: "#4ade80", format: fmtVND },
      { key: "cost", name: "Chi phí", color: chart.roseBarCost, format: fmtVND },
    ],
    []
  );
  const lines = useMemo(() => [{ key: "profit", name: "Lợi nhuận", color: chart.cyanLine, format: fmtVND }], []);
  const barAxis = useMemo(
    () => ({ max: customTicks[4], ticks: customTicks, formatter: fmtAxisMoney, tooltipFormatter: fmtVND }),
    [customTicks]
  );

  return (
    <ChartCard>
      <ChartHeader icon={TrendingUp} iconColor="#f43f5e" title="Doanh thu & Chi phí & Lợi nhuận">
        <TabToggle value={tf} onChange={onTf} options={TF_OPTIONS} />
      </ChartHeader>
      <BarLineChart data={data} height={280} bars={bars} lines={lines} barAxis={barAxis} gridColor={chart.greenGrid} xTickEvery={tf === "month" ? 5 : 1} />
    </ChartCard>
  );
}

export default React.memo(Chart06);
