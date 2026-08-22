// src/components/MiniAreaChart.js
// Biểu đồ area đơn giản dựng bằng react-native-svg, thay cho <AreaChart> của
// recharts (không chạy được trên RN — xem ghi chú rủi ro #1 trong
// progress.md). Đây là bản NHẸ, đủ dùng cho HomePage (đường xu hướng doanh
// thu 7 ngày); 10 chart component phức tạp hơn của AnalystPage (Giai đoạn
// 5.7 — EMA/MA/PID/heatmap/pie) vẫn cần quyết định thư viện chính thức ở
// mục 0.6 (victory-native / react-native-gifted-charts / tự vẽ SVG) trước
// khi chuyển, vì khối lượng lớn hơn nhiều so với 1 area chart đơn giản này.
import React from "react";
import { View, Text } from "react-native";
import Svg, { Polyline, Polygon, Line, Defs, LinearGradient, Stop } from "react-native-svg";
import colors from "../theme/tokens";

export default function MiniAreaChart({ data, xKey, yKey, height = 220, formatY }) {
  const width = 320; // scaled by viewBox, container stretches full width
  const values = data.map((d) => Number(d[yKey]) || 0);
  const maxV = Math.max(...values, 1) * 1.15;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const points = data.map((d, i) => {
    const x = padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotW);
    const y = padT + plotH - (Number(d[yKey]) / maxV) * plotH;
    return { x, y, label: d[xKey] };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${padL},${padT + plotH} ` + linePoints + ` ${padL + plotW},${padT + plotH}`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor={colors.green[500]} stopOpacity={0.28} />
            <Stop offset="95%" stopColor={colors.green[500]} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* baseline */}
        <Line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={colors.gray[200]} strokeWidth={1} />
        <Polygon points={areaPoints} fill="url(#areaFill)" />
        <Polyline points={linePoints} fill="none" stroke={colors.green[500]} strokeWidth={2.5} />
      </Svg>
      <View className="flex-row justify-between px-2 -mt-2">
        {points.map((p, i) => (
          <Text key={i} className="text-[10px] text-gray-400" style={{ width: `${100 / points.length}%`, textAlign: "center" }}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
