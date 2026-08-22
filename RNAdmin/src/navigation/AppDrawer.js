// src/navigation/AppDrawer.js
// [NEN-MONG] Drawer Navigator dựng từ mảng NAV (navConfig.js), tương đương
// AppDrawer trong progress.md Giai đoạn 3.1: mirror 13 mục của SidePage.js.
// Mỗi screen được bọc withProtection() để áp đúng 3 tầng điều kiện của
// ProtectedRoute gốc (đăng nhập → đang làm việc → quyền admin nếu cần).
//
// Các trang nghiệp vụ thật (Giai đoạn 5) hiện là PlaceholderPage — thay
// bằng component thật khi chuyển từng trang, KHÔNG cần sửa gì ở file này
// ngoài đổi import.
import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import CustomDrawerContent from "./CustomDrawerContent";
import AppHeader from "./AppHeader";
import { withProtection } from "./ProtectedScreen";
import { NAV, ADMIN_ONLY_SCREENS } from "./navConfig";
import { makePlaceholder } from "../pages/PlaceholderPage";
import HomePage from "../pages/HomePage";
import CashFlowPage from "../pages/CashFlow";
import CustomersPage from "../pages/Customers";

const Drawer = createDrawerNavigator();

// Home/CashFlow/Customers đã có bản thật; CashFlow.js đã được viết ở một
// phiên trước nhưng chưa từng gắn vào map này (bị bỏ sót bước cuối) — gắn
// lại cùng lúc thêm Customers ở phiên này. Các trang còn lại dùng
// placeholder chung, gắn đúng tên hiển thị.
const SCREEN_COMPONENTS = {
  Home: HomePage,
  CashFlow: CashFlowPage,
  Customers: CustomersPage,
};

export default function AppDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        header: (props) => <AppHeader {...props} />,
        drawerType: "front",
        overlayColor: "rgba(0,0,0,0.2)",
        drawerStyle: { width: 224 },
      }}
    >
      {NAV.map(({ screen, label }) => {
        const RawComponent = SCREEN_COMPONENTS[screen] ?? makePlaceholder(label);
        const requireAdmin = ADMIN_ONLY_SCREENS.has(screen);
        return (
          <Drawer.Screen
            key={screen}
            name={screen}
            component={withProtection(RawComponent, { requireAdmin })}
            options={{ title: label }}
          />
        );
      })}
    </Drawer.Navigator>
  );
}
