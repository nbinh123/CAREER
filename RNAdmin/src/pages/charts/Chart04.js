// src/pages/charts/Chart04.js
// [UI] Chuyển từ Chart04.js gốc. Giữ nguyên 100% addEMA + logic
// topTick/customTicks (Math.ceil vì số bill là số nguyên) + formatYAxis
// (đúng y hệt công thức gốc, dù dùng chung logic định dạng tiền cho số đếm).
import React, { useMemo } from "react";
import { View } from "react-native";
import { ShoppingCart } from "lucide-react-native";
import { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import PeriodInput from "./sub_components/PeriodInput";
import BarLineChart from "./sub_components/BarLineChart";
import { addEMA, fmtAxisMoney } from "./helpers/mathHelpers";

export default function Chart04({ data = [], tf = "day", emaPeriod = 5, onTf, onEma }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    return addEMA(safeData, "bills", emaPeriod);
  }, [data, emaPeriod]);

  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((item) => Math.max(item.bills || 0, item.ema || 0))) : 0;
  const topTick = maxVal > 0 ? maxVal * 2 : 10;
  const customTicks = [0, Math.ceil(topTick * 0.25), Math.ceil(topTick * 0.5), Math.ceil(topTick * 0.75), Math.ceil(topTick)];

  return (
    <ChartCard>
      <ChartHeader icon={ShoppingCart} iconColor="#0ea5e9" title="Số lượng bill">
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <TabToggle value={tf} onChange={onTf} options={[["day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"]]} />
          <PeriodInput label="EMA" value={emaPeriod} onChange={onEma} min={2} bg="#f0f9ff" border="#bae6fd" text="#0369a1" textDim="#7dd3fc" />
        </View>
      </ChartHeader>
      <BarLineChart
        data={chartData}
        height={230}
        bars={[{ key: "bills", name: "Số bill", color: chart.skyBar }]}
        lines={[{ key: "ema", name: `EMA (${emaPeriod} kỳ trước)`, color: chart.skyLine }]}
        barAxis={{ max: customTicks[4], ticks: customTicks, formatter: fmtAxisMoney }}
        gridColor={chart.skyGrid}
        xTickEvery={tf === "month" ? 5 : 1}
      />
    </ChartCard>
  );
}
