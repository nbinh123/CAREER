import React from "react";
import { View } from "react-native";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/common/Loading";
import AppHeader from "../components/common/AppHeader";
import AuthStackNavigator from "./AuthStackNavigator";
import MainTabNavigator from "./MainTabNavigator";


// Tương đương RootNavigator được nhắc tới trong HUONG_DAN_TICH_HOP.md (giả
// định đã dựng ở Giai đoạn 4). Bản chạy độc lập này viết mới, chuyển đổi
// Auth Stack <-> Main Tab Navigator dựa trên useAuth().isAuthenticated.
//
// AppHeader chỉ mount khi ĐÃ đăng nhập — AuthStackNavigator (Login/Register)
// đã tự có logo riêng trong bố cục của nó (xem LoginScreen.jsx), ghép thêm
// AppHeader vào đó sẽ bị lặp logo lần nữa. Đặt AppHeader NGANG HÀNG (không
// nằm trong) Tab.Navigator để nó không unmount/remount khi đổi tab — đó là
// điều kiện để tiêu đề trang giữ ĐÚNG 1 vị trí cố định và crossfade được
// (xem AppHeader.jsx), thay vì mỗi tab tự vẽ header riêng như trước.
export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading label="Đang kiểm tra đăng nhập..." />;
  }

  if (!isAuthenticated) {
    return <AuthStackNavigator />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      <View style={{ flex: 1 }}>
        <MainTabNavigator />
      </View>
    </View>
  );
}
