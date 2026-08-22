import React from "react";
import { View, Text } from "react-native";
import { Construction } from "lucide-react-native";
import colors from "../theme/tokens";

export default function PlaceholderPage({ title, note }) {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <View className="w-16 h-16 rounded-2xl bg-emerald-50 items-center justify-center mb-4">
        <Construction size={28} color={colors.emerald[600]} strokeWidth={2.2} />
      </View>
      <Text className="text-lg font-extrabold text-gray-800 mb-1 text-center">{title}</Text>
      <Text className="text-sm text-gray-500 text-center max-w-xs">
        {note || "Trang này thuộc Giai đoạn 5, đang chờ chuyển đổi UI. Điều hướng, quyền truy cập và nền tảng dữ liệu đã sẵn sàng."}
      </Text>
    </View>
  );
}

/** Factory tạo nhanh 1 component placeholder gắn sẵn title cho từng screen. */
export function makePlaceholder(title, note) {
  return function Placeholder() {
    return <PlaceholderPage title={title} note={note} />;
  };
}
