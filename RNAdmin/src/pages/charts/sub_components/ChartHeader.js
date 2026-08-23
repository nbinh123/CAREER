// src/pages/charts/sub_components/ChartHeader.js
// [UI] div/className → View/Text, Icon (lucide-react) → lucide-react-native.
// `iconColor` bản gốc là 1 className Tailwind text-color (vd "text-green-500")
// dùng làm màu icon SVG — lucide-react-native nhận màu qua prop `color` (hex),
// không nhận className, nên đổi hợp đồng prop: bản RN nhận `iconColor` là hex
// trực tiếp (xem README mục "AlertCircle → CircleAlert" về khác biệt icon
// giữa 2 bản lucide). Mỗi Chart0X RN truyền hex thay vì className khi gọi.
import React from "react";
import { View, Text } from "react-native";

function ChartHeader({ icon: Icon, iconColor, title, children }) {
  return (
    <View className="flex-row items-center justify-between mb-4 flex-wrap gap-2">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color={iconColor} />
        <Text className="font-bold text-gray-700 text-sm">{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default React.memo(ChartHeader);
