// src/pages/charts/sub_components/DonutChart.js
// [MOI] Thay <PieChart>/<Pie> của recharts — tự vẽ donut bằng react-native-svg
// <Path> (cung tròn arc), công thức toạ độ cung tròn + vị trí nhãn % giữ
// đúng logic PieLabel.js gốc (điểm giữa bán kính trong/ngoài theo midAngle).
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";

const R = Math.PI / 180;

function arcPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const p1 = { x: cx + outerR * Math.cos(startAngle * R), y: cy + outerR * Math.sin(startAngle * R) };
  const p2 = { x: cx + outerR * Math.cos(endAngle * R), y: cy + outerR * Math.sin(endAngle * R) };
  const p3 = { x: cx + innerR * Math.cos(endAngle * R), y: cy + innerR * Math.sin(endAngle * R) };
  const p4 = { x: cx + innerR * Math.cos(startAngle * R), y: cy + innerR * Math.sin(startAngle * R) };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

export default function DonutChart({ data = [], colors = [], size = 200, innerRatio = 0.58, paddingAngle = 2 }) {
  const [selected, setSelected] = useState(null);
  const total = data.reduce((s, d) => s + (Number(d?.value) || 0), 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * innerRatio;

  let angle = -90;
  const slices = data.map((d, i) => {
    const value = Number(d?.value) || 0;
    const sweep = (value / total) * 360;
    const start = angle + paddingAngle / 2;
    const end = angle + sweep - paddingAngle / 2;
    angle += sweep;
    const mid = (start + end) / 2;
    const midR = innerR + (outerR - innerR) * 0.5;
    const percent = value / total;
    return {
      d,
      value,
      percent,
      color: colors[i % colors.length],
      path: end > start ? arcPath(cx, cy, innerR, outerR, start, end) : null,
      labelX: cx + midR * Math.cos(mid * R),
      labelY: cy + midR * Math.sin(mid * R),
    };
  });

  const activeSlice = selected != null ? slices[selected] : null;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {slices.map((s, i) =>
            s.path ? (
              <Path
                key={i}
                d={s.path}
                fill={s.color}
                opacity={selected == null || selected === i ? 1 : 0.35}
                onPress={() => setSelected(selected === i ? null : i)}
              />
            ) : null
          )}
          {slices.map(
            (s, i) =>
              s.percent >= 0.05 && (
                <SvgText key={`lbl${i}`} x={s.labelX} y={s.labelY} fill="white" fontSize={11} fontWeight="700" textAnchor="middle">
                  {`${(s.percent * 100).toFixed(0)}%`}
                </SvgText>
              )
          )}
        </Svg>
        {/* Tâm donut — tổng hoặc món đang chọn */}
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
          <Text className="text-xs text-gray-400" numberOfLines={1}>
            {activeSlice ? activeSlice.d.name : "Tổng"}
          </Text>
          <Text className="text-base font-black text-gray-700">{activeSlice ? activeSlice.value : total}</Text>
        </View>
      </View>

      {/* Legend — chạm để làm nổi bật lát tương ứng, thay tooltip hover */}
      <View className="w-full flex-row flex-wrap gap-x-6 gap-y-1.5 mt-1 px-2">
        {slices.map((s, i) => (
          <Pressable key={i} onPress={() => setSelected(selected === i ? null : i)} className="flex-row items-center gap-2 min-w-0" style={{ width: "45%" }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text className="text-xs text-gray-600 flex-1" numberOfLines={1}>{s.d.name}</Text>
            <Text className="text-xs font-mono text-gray-400">{s.value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
