// src/pages/charts/Chart05.js
// [UI] Chuyển từ Chart05.js gốc. Giữ nguyên 100% addEMA + logic
// topTick/customTicks/formatYAxis.
//
// [SUA — tối ưu hiệu suất, đợt 2] React.memo + useMemo cho bars/lines/barAxis
// + TF_OPTIONS hoist module scope (xem ghi chú ở Chart01/02.js).
import React, { useMemo } from "react";
import { View } from "react-native";
import { Users } from "lucide-react-native";
import fmtVND from "../../utils/fmtVND";
import { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import PeriodInput from "./sub_components/PeriodInput";
import BarLineChart from "./sub_components/BarLineChart";
import { addEMA, fmtAxisMoney } from "./helpers/mathHelpers";

const TF_OPTIONS = [
  ["day", "Ngày"],
  ["week", "Tuần"],
  ["month", "Tháng"],
];

function Chart05({ data = [], tf = "day", emaPeriod = 5, onTf, onEma }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    return addEMA(safeData, "avgBill", emaPeriod);
  }, [data, emaPeriod]);

  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((item) => Math.max(item.avgBill || 0, item.ema || 0))) : 0;
  const topTick = maxVal > 0 ? maxVal * 2 : 1000;
  const customTicks = useMemo(() => [0, topTick * 0.25, topTick * 0.5, topTick * 0.75, topTick], [topTick]);

  const bars = useMemo(() => [{ key: "avgBill", name: "Bill TB", color: chart.amberBar, format: fmtVND }], []);
  const lines = useMemo(
    () => [{ key: "ema", name: `EMA (${emaPeriod} kỳ trước)`, color: chart.amberLine, format: fmtVND }],
    [emaPeriod]
  );
  const barAxis = useMemo(
    () => ({ max: customTicks[4], ticks: customTicks, formatter: fmtAxisMoney, tooltipFormatter: fmtVND }),
    [customTicks]
  );

  return (
    <ChartCard>
      <ChartHeader icon={Users} iconColor="#f59e0b" title="Giá trị bill trung bình">
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <TabToggle value={tf} onChange={onTf} options={TF_OPTIONS} />
          <PeriodInput label="EMA" value={emaPeriod} onChange={onEma} min={2} bg="#fffbeb" border="#fde68a" text="#b45309" textDim="#fcd34d" />
        </View>
      </ChartHeader>
      <BarLineChart data={chartData} height={230} bars={bars} lines={lines} barAxis={barAxis} gridColor={chart.amberGrid} xTickEvery={tf === "month" ? 5 : 1} />
    </ChartCard>
  );
}

export default React.memo(Chart05);
