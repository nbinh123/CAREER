// src/pages/charts/sub_components/RangeSlider.js
// [MOI] Thay <input type="range"> — không có sẵn @react-native-community/slider
// trong package.json (thêm native module mới ngoài phạm vi bàn giao lần này,
// cần `npx expo install` + rebuild dev client). Tự dựng bằng PanResponder
// (có sẵn trong react-native core, không cần cài thêm gì) — đủ cho nhu cầu
// kéo chỉnh Kp/Ki/Kd ở Chart10. Giữ đúng hợp đồng prop kiểu input range
// (min/max/step/value/onChange) để chỗ gọi ở Chart10 gần như không đổi.
import React, { useRef, useState, useCallback } from "react";
import { View, PanResponder } from "react-native";

export default function RangeSlider({ min = 0, max = 1, step = 0.01, value, onChange, color = "#22c55e" }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);

  const clamp = (v) => Math.min(max, Math.max(min, v));
  const snap = (v) => {
    const steps = Math.round((v - min) / step);
    return clamp(min + steps * step);
  };

  const valueFromX = useCallback(
    (x) => {
      if (widthRef.current <= 0) return value;
      const ratio = clamp(x) / widthRef.current;
      return snap(min + ratio * (max - min));
    },
    [min, max, step, value]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const next = valueFromX(evt.nativeEvent.locationX);
        if (next !== value) onChange(next);
      },
      onPanResponderMove: (evt) => {
        const next = valueFromX(evt.nativeEvent.locationX);
        if (next !== value) onChange(next);
      },
    })
  ).current;

  const ratio = max > min ? (clamp(value) - min) / (max - min) : 0;

  return (
    <View
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setTrackWidth(e.nativeEvent.layout.width);
      }}
      {...panResponder.panHandlers}
      style={{ height: 20, justifyContent: "center" }}
    >
      <View style={{ height: 6, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${ratio * 100}%`, backgroundColor: color, borderRadius: 999 }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: Math.max(0, ratio * trackWidth - 8),
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: "#fff",
          borderWidth: 2,
          borderColor: color,
        }}
      />
    </View>
  );
}
