// src/navigation/RootNavigator.js
// [NEN-MONG] Nhánh chưa đăng nhập (Stack: Login) vs nhánh đã đăng nhập
// (Stack chứa Main=AppDrawer + các màn được push đè lên từ trong Drawer:
// Register, Shift) — tương đương logic `isLoggedIn` điều hướng route trong
// App.js gốc. Đây chính là điểm khác biệt kiến trúc lớn nhất so với web:
// thay vì 1 cây Route phẳng + ProtectedRoute che từng nhánh, RN tách hẳn 2
// cây điều hướng độc lập theo trạng thái đăng nhập, đúng khuyến nghị chuẩn
// của React Navigation.
//
// [PERF-FIX] File này được App.js require ngay từ đầu (kể cả trước khi
// đăng nhập, vì import tĩnh của LoginPage/RegisterPage/AppDrawer đều bị
// evaluate ngay khi module RootNavigator.js được load — không đợi tới lúc
// isAuthenticated=true). RegisterPage chỉ admin mới dùng, không cần thiết
// phải trả phí evaluate module ngay từ màn hình Login → chuyển sang
// React.lazy, bọc Suspense qua withSuspense.js (xem thêm ghi chú tương tự
// ở AppDrawer.js — nguồn chính của vấn đề nằm ở đó, 12 trang + 10 chart).
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import useAuthZustand from "../zustand/useAuthZustand";
import AppDrawer from "./AppDrawer";
import LoginPage from "../pages/LoginPage";
import { withProtection } from "./ProtectedScreen";
import withSuspense from "./withSuspense";
import { makePlaceholder } from "../pages/PlaceholderPage";

const RegisterPage = React.lazy(() => import("../pages/RegisterPage"));

const Stack = createNativeStackNavigator();
const ShiftScreen = withProtection(makePlaceholder("Ca làm việc"));
const ProtectedRegister = withSuspense(withProtection(RegisterPage, { allowedRoles: ["admin"] }));

export default function RootNavigator() {
  const isAuthenticated = useAuthZustand((s) => s.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginPage} />
      ) : (
        <>
          <Stack.Screen name="Main" component={AppDrawer} />
          <Stack.Screen
            name="Register"
            component={ProtectedRegister}
            options={{ headerShown: true, title: "Đăng ký nhân viên", presentation: "card" }}
          />
          <Stack.Screen
            name="Shift"
            component={ShiftScreen}
            options={{ headerShown: true, title: "Ca làm việc", presentation: "card" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
