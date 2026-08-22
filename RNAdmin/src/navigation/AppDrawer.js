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
import IngredientsPage from "../pages/IngredientsPage";
import MenuPage from "../pages/MenuPage";
import FruitPage from "../pages/FruitPage";
import OnlineOrdersPage from "../pages/OnlineOrdersPage";
import StoragePage from "../pages/StoragePage";
import VoucherPage from "../pages/VoucherPage";

const Drawer = createDrawerNavigator();

// [FIX] Menu/Fruit/Online/Storage/Voucher đã được viết đầy đủ (file thật,
// không phải placeholder — xem MenuPage.js, FruitPage.js,
// OnlineOrdersPage.js, StoragePage.js, VoucherPage.js) nhưng bị bỏ sót bước
// gắn vào map này, y hệt tình huống từng xảy ra với CashFlow trước đây.
// Hậu quả: 5 trang này là dead code, Drawer luôn hiện PlaceholderPage thay
// vì bản thật dù đã tồn tại sẵn. Gắn lại ở đây. Chỉ còn Orders, Analyst,
// StaffManager, Kitchen là thật sự chưa có file — vẫn dùng placeholder.
const SCREEN_COMPONENTS = {
  Home: HomePage,
  CashFlow: CashFlowPage,
  Customers: CustomersPage,
  Ingredients: IngredientsPage,
  Menu: MenuPage,
  Fruit: FruitPage,
  Online: OnlineOrdersPage,
  Storage: StoragePage,
  Voucher: VoucherPage,
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
