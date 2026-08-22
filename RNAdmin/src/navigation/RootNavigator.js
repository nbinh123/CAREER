// src/navigation/RootNavigator.js
// [NEN-MONG] Nhánh chưa đăng nhập (Stack: Login) vs nhánh đã đăng nhập
// (Stack chứa Main=AppDrawer + các màn được push đè lên từ trong Drawer:
// Register, Shift) — tương đương logic `isLoggedIn` điều hướng route trong
// App.js gốc. Đây chính là điểm khác biệt kiến trúc lớn nhất so với web:
// thay vì 1 cây Route phẳng + ProtectedRoute che từng nhánh, RN tách hẳn 2
// cây điều hướng độc lập theo trạng thái đăng nhập, đúng khuyến nghị chuẩn
// của React Navigation.
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import useAuthZustand from "../zustand/useAuthZustand";
import AppDrawer from "./AppDrawer";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import { withProtection } from "./ProtectedScreen";
import { makePlaceholder } from "../pages/PlaceholderPage";

const Stack = createNativeStackNavigator();
const ShiftScreen = withProtection(makePlaceholder("Ca làm việc"));
const ProtectedRegister = withProtection(RegisterPage, { requireAdmin: true });

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
