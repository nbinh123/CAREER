// src/pages/charts/Chart02.js
// [UI] Chuyển từ Chart02.js gốc. Bản gốc không tự định nghĩa domain/ticks
// (để recharts tự auto-scale) — ở đây tự tính topTick = max*1.2 (đệm 20%)
// làm tương đương, vì BarLineChart cần trục Y tường minh. Giữ nguyên màu
// xen kẽ theo index (Cell gốc) qua colorByIndex.
import React from "react";
import { BarChart2 } from "lucide-react-native";
import fmtVND from "../../utils/fmtVND";
import colors, { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import BarLineChart from "./sub_components/BarLineChart";
import { fmtK } from "./helpers/mathHelpers";

export default function Chart02({ data = {}, tf = "week", onTf }) {
  const chartData = data?.days || [];
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((d) => d.revenue || 0)) : 0;
  const topTick = maxVal > 0 ? maxVal * 1.2 : 1000;
  const customTicks = [0, topTick * 0.25, topTick * 0.5, topTick * 0.75, topTick];

  return (
    <ChartCard>
      <ChartHeader icon={BarChart2} iconColor={colors.blue[500]} title={`Doanh thu trong ${tf === "week" ? "tuần" : "tháng"}`}>
        <TabToggle value={tf} onChange={onTf} options={[["week", "Tuần"], ["month", "Tháng"]]} />
      </ChartHeader>
      <BarLineChart
        data={chartData}
        height={260}
        bars={[
          {
            key: "revenue",
            name: "Doanh thu",
            color: chart.blueBarA,
            colorByIndex: (i) => (i % 2 === 0 ? chart.blueBarA : chart.blueBarB),
            format: fmtVND,
          },
        ]}
        barAxis={{ max: customTicks[4], ticks: customTicks, formatter: fmtK, tooltipFormatter: fmtVND }}
        gridColor={chart.blueGrid}
        xTickEvery={tf === "month" ? 5 : 1}
      />
    </ChartCard>
  );
}
