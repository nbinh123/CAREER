// src/pages/charts/Chart01.js
// [UI] Chuyển từ Chart01.js gốc. Giữ nguyên 100% logic tính topTick/customTicks
// (kể cả hệ số 1.5 — không phải 2 như đa số chart khác, đúng y bản gốc) và
// addEMA. Chỉ đổi lớp hiển thị: ComposedChart (recharts) → BarLineChart (SVG
// tự vẽ, xem ghi chú quyết định thư viện ở sub_components/BarLineChart.js).
import React, { useMemo } from "react";
import { DollarSign } from "lucide-react-native";
import fmtVND from "../../utils/fmtVND";
import colors, { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import BarLineChart from "./sub_components/BarLineChart";
import { addEMA, fmtK } from "./helpers/mathHelpers";

export default function Chart01({ data = [], emaPeriod = 5 }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    return addEMA(safeData, "revenue", emaPeriod);
  }, [data, emaPeriod]);

  const maxRevenue = chartData.length > 0 ? Math.max(...chartData.map((item) => item.revenue || 0)) : 0;
  const high = 1.5;
  const topTick = maxRevenue > 0 ? maxRevenue * high : 1000;
  const customTicks = [0, topTick * 0.25, topTick * 0.5, topTick * 0.75, topTick];

  return (
    <ChartCard>
      <ChartHeader icon={DollarSign} iconColor={colors.green[500]} title="Doanh thu theo giờ trong ngày" />
      <BarLineChart
        data={chartData}
        height={260}
        bars={[{ key: "revenue", color: chart.greenBar, name: "Doanh thu", format: fmtVND }]}
        lines={[{ key: "ema", color: chart.greenLine, name: "EMA (5)", format: fmtVND }]}
        barAxis={{ max: customTicks[4], ticks: customTicks, formatter: fmtK, tooltipFormatter: fmtVND }}
        gridColor={chart.greenGrid}
        xTickEvery={3}
      />
    </ChartCard>
  );
}
