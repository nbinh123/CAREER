// src/pages/charts/sub_components/Heatmap.js
// [UI] Bản gốc vốn đã chỉ là lưới <div> tô màu nền (không dùng recharts) —
// chuyển gần như 1-1 sang View, chỉ đổi title="..." (tooltip HTML, không có
// trên RN) thành chạm-để-xem-số bên dưới lưới. ScrollView ngang thay
// overflow-x-auto.
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { DAYS_VN, heatColor } from "../helpers/mathHelpers";

const CELL = 24;
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

export default function Heatmap({ data = [] }) {
  const [sel, setSel] = useState(null);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 26 + HOURS.length * (CELL + 4) }}>
          {/* Nhãn giờ */}
          <View className="flex-row mb-1" style={{ marginLeft: 26 }}>
            {HOURS.map((h) => (
              <Text key={h} className="text-[9px] text-gray-400 font-medium text-center" style={{ width: CELL, marginRight: 4 }}>
                {h}h
              </Text>
            ))}
          </View>

          {data.map((row, di) => (
            <View key={di} className="flex-row items-center mb-1">
              <Text className="text-xs text-gray-500 font-bold text-right mr-1" style={{ width: 22 }}>
                {DAYS_VN[di]}
              </Text>
              {(Array.isArray(row) ? row : []).map((cell, hi) => {
                const isSel = sel && sel.di === di && sel.hi === hi;
                return (
                  <Pressable
                    key={hi}
                    onPress={() => setSel(isSel ? null : { di, hi, val: cell?.val ?? 0, hour: cell?.hour })}
                    style={{
                      backgroundColor: heatColor(cell?.val ?? 0),
                      width: CELL,
                      height: 20,
                      borderRadius: 5,
                      marginRight: 4,
                      borderWidth: isSel ? 2 : 0,
                      borderColor: "#0f766e",
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Ô đang chọn — thay tooltip title="" của bản web */}
      {sel && (
        <Text className="text-xs text-gray-500 mt-2">
          {DAYS_VN[sel.di]} {sel.hour}h: <Text className="font-mono font-semibold text-gray-700">{sel.val}</Text>
        </Text>
      )}

      {/* Thang màu */}
      <View className="flex-row items-center gap-2 mt-3" style={{ marginLeft: 26 }}>
        <Text className="text-xs text-gray-400">Thấp</Text>
        {["#f0fdf4", "#bbf7d0", "#4ade80", "#22c55e", "#15803d"].map((c) => (
          <View key={c} style={{ backgroundColor: c, width: 16, height: 11, borderRadius: 3 }} />
        ))}
        <Text className="text-xs text-gray-400">Cao</Text>
      </View>
    </View>
  );
}
