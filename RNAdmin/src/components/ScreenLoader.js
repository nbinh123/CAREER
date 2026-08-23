// src/components/ScreenLoader.js
// [PERF] Fallback cho <Suspense> bọc quanh các trang React.lazy() trong
// AppDrawer.js / RootNavigator.js — xem ghi chú ở 2 file đó. Vì màn hình đã
// nằm sẵn trong bundle (Metro không thật sự tách bundle theo network cho
// RN), fallback này chỉ hiện trong khoảng thời gian module được evaluate
// (thường dưới 1 frame), không phải chờ tải mạng.
import React from "react";
import { View, ActivityIndicator } from "react-native";
import colors from "../theme/tokens";

export default function ScreenLoader() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}>
      <ActivityIndicator size="large" color={colors.green[500]} />
    </View>
  );
}
