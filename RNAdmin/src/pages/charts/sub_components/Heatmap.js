// src/pages/charts/sub_components/Heatmap.js
// [UI] Bản gốc vốn đã chỉ là lưới <div> tô màu nền (không dùng recharts) —
// chuyển gần như 1-1 sang View, chỉ đổi title="..." (tooltip HTML, không có
// trên RN) thành chạm-để-xem-số bên dưới lưới. ScrollView ngang thay
// overflow-x-auto.
//
// [SUA — tối ưu hiệu suất, đợt 2] Bản đầu mỗi Ô là 1 <Pressable> riêng — lưới
// tối đa 7 ngày × 15 giờ = 105 Pressable phải mount/đăng ký gesture responder
// cùng lúc mỗi khi Heatmap render. Đổi: 105 ô màu giờ là <View> thường (rẻ
// hơn nhiều, không cần gesture), CHỈ 1 Pressable phủ toàn lưới, tự suy ra
// (ngày, giờ) bị chạm từ toạ độ locationX/locationY theo đúng kích thước ô cố
// định (CELL_PITCH_X/ROW_PITCH_Y) — cùng cách làm với BarLineChart.js.
import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { DAYS_VN, heatColor } from "../helpers/mathHelpers";

const CELL = 24;
const CELL_GAP = 4;
const CELL_PITCH_X = CELL + CELL_GAP; // 28
const ROW_HEIGHT = 20;
const ROW_GAP = 4; // mb-1
const ROW_PITCH_Y = ROW_HEIGHT + ROW_GAP; // 24
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

function Heatmap({ data = [] }) {
  const [sel, setSel] = useState(null);

  const handleGridPress = useCallback(
    (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const hi = Math.floor(locationX / CELL_PITCH_X);
      const di = Math.floor(locationY / ROW_PITCH_Y);
      if (di < 0 || di >= data.length) return;
      const row = Array.isArray(data[di]) ? data[di] : [];
      if (hi < 0 || hi >= row.length) return;
      const cell = row[hi];
      setSel((prev) => (prev && prev.di === di && prev.hi === hi ? null : { di, hi, val: cell?.val ?? 0, hour: cell?.hour }));
    },
    [data]
  );

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 26 + HOURS.length * CELL_PITCH_X }}>
          {/* Nhãn giờ */}
          <View className="flex-row mb-1" style={{ marginLeft: 26 }}>
            {HOURS.map((h) => (
              <Text key={h} className="text-[9px] text-gray-400 font-medium text-center" style={{ width: CELL, marginRight: CELL_GAP }}>
                {h}h
              </Text>
            ))}
          </View>

          {/* Lưới ô màu (View thường — không gesture) + 1 Pressable phủ lên trên */}
          <View style={{ position: "relative" }}>
            {data.map((row, di) => (
              <View key={di} className="flex-row items-center mb-1">
                <Text className="text-xs text-gray-500 font-bold text-right mr-1" style={{ width: 22 }}>
                  {DAYS_VN[di]}
                </Text>
                {(Array.isArray(row) ? row : []).map((cell, hi) => {
                  const isSel = sel && sel.di === di && sel.hi === hi;
                  return (
                    <View
                      key={hi}
                      style={{
                        backgroundColor: heatColor(cell?.val ?? 0),
                        width: CELL,
                        height: ROW_HEIGHT,
                        borderRadius: 5,
                        marginRight: CELL_GAP,
                        borderWidth: isSel ? 2 : 0,
                        borderColor: "#0f766e",
                      }}
                    />
                  );
                })}
              </View>
            ))}
            <Pressable onPress={handleGridPress} style={{ position: "absolute", top: 0, left: 26, right: 0, bottom: 0 }} />
          </View>
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

export default React.memo(Heatmap);
