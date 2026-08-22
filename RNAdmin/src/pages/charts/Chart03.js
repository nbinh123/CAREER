// src/pages/charts/Chart03.js
// [UI] Chuyển từ Chart03.js gốc. Giữ nguyên 100% addMA + logic tính
// topTick/customTicks/c3Interval. <input type="date"> → DateField
// (DateTimePicker), <input type="number"> (MA kỳ) → PeriodInput.
import React, { useMemo } from "react";
import { View } from "react-native";
import { Calendar } from "lucide-react-native";
import { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import BarLineChart from "./sub_components/BarLineChart";
import DateField from "./sub_components/DateField";
import PeriodInput from "./sub_components/PeriodInput";
import { addMA, fmtAxisMoney } from "./helpers/mathHelpers";
import fmtVND from "../../utils/fmtVND";

export default function Chart03({ data = [], dateFrom, dateTo, maPeriod = 7, onDateFrom, onDateTo, onMaPeriod }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (!safeData.length) return [];
    return addMA(safeData, "revenue", maPeriod);
  }, [data, maPeriod]);

  const c3Interval = Math.max(0, Math.floor(chartData.length / 9) - 1);
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((item) => Math.max(item.revenue || 0, item.ma || 0))) : 0;
  const topTick = maxVal > 0 ? maxVal * 2 : 1000;
  const customTicks = [0, topTick * 0.25, topTick * 0.5, topTick * 0.75, topTick];

  return (
    <ChartCard>
      <ChartHeader icon={Calendar} iconColor="#8b5cf6" title="Doanh thu theo khoảng thời gian">
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <DateField label="Từ" value={dateFrom} onChange={onDateFrom} />
          <DateField label="Đến" value={dateTo} onChange={onDateTo} />
          <PeriodInput
            label="MA"
            value={maPeriod}
            onChange={onMaPeriod}
            min={2}
            bg="#f5f3ff"
            border="#ddd6fe"
            text="#6d28d9"
            textDim="#a78bfa"
          />
        </View>
      </ChartHeader>

      <BarLineChart
        data={chartData}
        height={260}
        bars={[{ key: "revenue", name: "Doanh thu", color: chart.violetBar, format: fmtVND }]}
        lines={[{ key: "ma", name: `MA (${maPeriod} kỳ trước)`, color: chart.violetLine, format: fmtVND }]}
        barAxis={{ max: customTicks[4], ticks: customTicks, formatter: fmtAxisMoney, tooltipFormatter: fmtVND }}
        gridColor={chart.violetGrid}
        xTickEvery={c3Interval + 1}
        emptyLabel="Chọn khoảng thời gian hợp lệ"
      />
    </ChartCard>
  );
}
