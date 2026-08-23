// src/pages/charts/Chart09.js
// [UI] Chuyển từ Chart09.js gốc. Pie (recharts) → DonutChart (SVG tự vẽ),
// heatmap div-grid → Heatmap (đã gần như giữ nguyên, xem ghi chú ở đó).
//
// [SUA — tối ưu hiệu suất, đợt 2] React.memo + TF_OPTIONS hoist module scope.
// Không cần useMemo cho `colors={chart.pieColors}` vì đó đã là tham chiếu ổn
// định từ theme/tokens.js (không phải literal tạo mới mỗi render).
import React from "react";
import { View, Text } from "react-native";
import { PieChart as PieIcon, Grid3x3 } from "lucide-react-native";
import { chart } from "../../theme/tokens";
import ChartCard from "./sub_components/ChartCard";
import ChartHeader from "./sub_components/ChartHeader";
import TabToggle from "./sub_components/TabToggle";
import DonutChart from "./sub_components/DonutChart";
import Heatmap from "./sub_components/Heatmap";

const TF_OPTIONS = [
  ["day", "Ngày"],
  ["week", "Tuần"],
  ["month", "Tháng"],
];

function Chart09({ pieData = [], heatmapData = [], tfPie = "day", onTfPie }) {
  return (
    <View style={{ gap: 20 }}>
      <ChartCard>
        <ChartHeader icon={PieIcon} iconColor="#a855f7" title="Top món ăn">
          <TabToggle value={tfPie} onChange={onTfPie} options={TF_OPTIONS} />
        </ChartHeader>
        {pieData.length > 0 ? (
          <DonutChart data={pieData} colors={chart.pieColors} size={220} />
        ) : (
          <View style={{ height: 100, alignItems: "center", justifyContent: "center" }}>
            <Text className="text-sm text-gray-400">Chưa có dữ liệu</Text>
          </View>
        )}
      </ChartCard>

      <ChartCard>
        <ChartHeader icon={Grid3x3} iconColor="#14b8a6" title="Mật độ khách theo giờ" />
        {heatmapData.length > 0 ? (
          <Heatmap data={heatmapData} />
        ) : (
          <View style={{ height: 100, alignItems: "center", justifyContent: "center" }}>
            <Text className="text-sm text-gray-400">Chưa có dữ liệu</Text>
          </View>
        )}
      </ChartCard>
    </View>
  );
}

export default React.memo(Chart09);
