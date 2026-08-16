import React from "react";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/common/Loading";
import AuthStackNavigator from "./AuthStackNavigator";
import MainTabNavigator from "./MainTabNavigator";

// Tương đương RootNavigator được nhắc tới trong HUONG_DAN_TICH_HOP.md (giả
// định đã dựng ở Giai đoạn 4). Bản chạy độc lập này viết mới, chuyển đổi
// Auth Stack <-> Main Tab Navigator dựa trên useAuth().isAuthenticated.
export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading label="Đang kiểm tra đăng nhập..." />;
  }

  return isAuthenticated ? <MainTabNavigator /> : <AuthStackNavigator />;
}
