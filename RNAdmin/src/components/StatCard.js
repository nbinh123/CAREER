// src/components/StatCard.js
// [UI] Chuyển từ components/StatCard.js gốc — icon + label + value + sub,
// 4 màu (green/blue/amber/rose), giữ nguyên contract prop.
import React from "react";
import { View, Text } from "react-native";
import colors from "../theme/tokens";

const BG = {
  green: colors.green[500],
  blue: colors.blue[500],
  amber: colors.amber[500],
  rose: colors.rose[500],
};

export default function StatCard({ icon: Icon, label, value, sub, color = "green" }) {
  return (
    <View className="bg-white rounded-2xl p-4 border border-gray-100 flex-row items-start gap-3 flex-1 min-w-[45%]">
      <View
        style={{ backgroundColor: BG[color] ?? BG.green }}
        className="w-11 h-11 rounded-xl items-center justify-center"
      >
        <Icon size={20} color={colors.white} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-xs text-gray-500 font-medium">{label}</Text>
        <Text className="text-lg font-bold text-gray-800 mt-0.5" numberOfLines={1}>
          {value}
        </Text>
        {!!sub && (
          <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}
