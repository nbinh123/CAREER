// src/pages/charts/sub_components/ChartCard.js
// [UI] div/className → View + className NativeWind, 1-1 với bản gốc.
import React from "react";
import { View } from "react-native";

function ChartCard({ children, className = "" }) {
  return (
    <View className={`bg-white rounded-2xl p-5 border border-gray-100 ${className}`}>{children}</View>
  );
}

export default React.memo(ChartCard);
