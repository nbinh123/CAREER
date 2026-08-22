// src/pages/charts/sub_components/PeriodInput.js
// [UI] Gom lại vì Chart03 (MA)/Chart04/Chart05 (EMA) đều lặp lại đúng 1 khối
// "input số kỳ" giống hệt nhau ở bản gốc — chỉ khác màu accent. Thay
// <input type="number"> bằng TextInput keyboardType="numeric", giữ nguyên
// logic validate (parseInt, chỉ chấp nhận >= min).
import React from "react";
import { View, Text, TextInput } from "react-native";

export default function PeriodInput({ label, unitLabel = "kỳ", value, onChange, min = 2, bg, border, text, textDim }) {
  return (
    <View
      className="flex-row items-center gap-1 rounded-lg px-2 py-1"
      style={{ backgroundColor: bg, borderWidth: 1, borderColor: border }}
    >
      <Text className="text-xs font-medium" style={{ color: text }}>{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={(str) => {
          const v = parseInt(str, 10);
          if (!isNaN(v) && v >= min) onChange(v);
          else if (str === "") onChange(value); // giữ nguyên khi đang gõ dở
        }}
        keyboardType="numeric"
        style={{ width: 28, fontSize: 12, fontWeight: "600", color: text, textAlign: "center", padding: 0 }}
      />
      <Text className="text-xs" style={{ color: textDim }}>{unitLabel}</Text>
    </View>
  );
}
