// src/pages/charts/Chart08.js
// [UI] Chuyển từ Chart08.js gốc. Khác Chart06 — 2 trục Y ở đây có domain
// THỰC SỰ khác nhau (số bill vs tiền), nên truyền cả barAxis lẫn lineAxis
// (dual axis thật) cho BarLineChart, không dùng chung 1 trục như Chart06.
//
// [SUA — tối ưu hiệu suất, đợt 2] React.memo + useMemo cho bars/lines/
// barAxis/lineAxis + TF_OPTIONS hoist module scope (xem ghi chú Chart01/02.js).
import React, { useMemo } from "react";
import { Users } from "lucide-react-native";
import fmtVND from "../../utils/fmtVND";
import { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import BarLineChart from "./sub_components/BarLineChart";
import { fmtAxisCount, fmtAxisMoney } from "./helpers/mathHelpers";

const TF_OPTIONS = [
  ["hour", "Giờ"],
  ["day", "Ngày"],
];

function Chart08({ data: rawData = [], tf = "hour", onTf }) {
  const data = Array.isArray(rawData) ? rawData : [];

  const maxBills = data.length > 0 ? Math.max(...data.map((d) => d.bills || 0)) : 0;
  const topTickBills = maxBills > 0 ? Math.ceil(maxBills * 1.4) : 10;

  const maxAvgBill = data.length > 0 ? Math.max(...data.map((d) => d.avgBill || 0)) : 0;
  const topTickAvgBill = maxAvgBill > 0 ? maxAvgBill * 1.4 : 100000;

  const billsTicks = useMemo(
    () => [0, topTickBills * 0.25, topTickBills * 0.5, topTickBills * 0.75, topTickBills],
    [topTickBills]
  );
  const avgBillTicks = useMemo(
    () => [0, topTickAvgBill * 0.25, topTickAvgBill * 0.5, topTickAvgBill * 0.75, topTickAvgBill],
    [topTickAvgBill]
  );

  const bars = useMemo(() => [{ key: "bills", name: "Số bill", color: chart.skyBar }], []);
  const lines = useMemo(() => [{ key: "avgBill", name: "Bill TB", color: "#f59e0b", format: fmtVND }], []);
  const barAxis = useMemo(() => ({ max: billsTicks[4], ticks: billsTicks, formatter: fmtAxisCount }), [billsTicks]);
  const lineAxis = useMemo(
    () => ({ max: avgBillTicks[4], ticks: avgBillTicks, formatter: fmtAxisMoney, tooltipFormatter: fmtVND }),
    [avgBillTicks]
  );

  return (
    <ChartCard>
      <ChartHeader icon={Users} iconColor="#0ea5e9" title="Lưu lượng khách & Bill trung bình">
        <TabToggle value={tf} onChange={onTf} options={TF_OPTIONS} />
      </ChartHeader>
      <BarLineChart
        data={data}
        height={260}
        bars={bars}
        lines={lines}
        barAxis={barAxis}
        lineAxis={lineAxis}
        gridColor={chart.skyGrid}
        xTickEvery={tf === "hour" ? 2 : 1}
      />
    </ChartCard>
  );
}

export default React.memo(Chart08);
