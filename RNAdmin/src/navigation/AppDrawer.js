// src/navigation/AppDrawer.js
// [NEN-MONG] Drawer Navigator dựng từ mảng NAV (navConfig.js), tương đương
// AppDrawer trong progress.md Giai đoạn 3.1: mirror 13 mục của SidePage.js.
// Mỗi screen được bọc withProtection() để áp đúng 3 tầng điều kiện của
// ProtectedRoute gốc (đăng nhập → đang làm việc → quyền admin nếu cần).
//
// Các trang nghiệp vụ thật (Giai đoạn 5) hiện là PlaceholderPage — thay
// bằng component thật khi chuyển từng trang, KHÔNG cần sửa gì ở file này
// ngoài đổi import.
//
// [PERF-FIX] TRƯỚC ĐÂY 12 trang (kể cả AnalystPage — file mà bản thân nó
// còn import cứng 10 file Chart01-10) được `import` tĩnh ở đầu file này.
// Import tĩnh luôn được evaluate ngay khi module được load, BẤT KỂ Drawer
// đã render hay chưa — mà AppDrawer.js lại được RootNavigator.js import
// tĩnh, còn RootNavigator.js được App.js require ngay từ đầu (kể cả trước
// khi đăng nhập, vì cây import được resolve tại lúc bundle chạy, không phải
// tại lúc component thật sự render). Hệ quả: ~650KB source code của TOÀN BỘ
// 12 trang + 10 chart phải chạy xong phần thân module (định nghĩa hàm,
// hằng số, style...) ngay tại thời điểm khởi động app / ngay sau khi login,
// dồn cục vào đúng lúc AppDrawer mount — góp phần vào cảm giác giật khi vừa
// đăng nhập / mới mở app.
//
// Đổi sang React.lazy(() => import(...)): Metro vẫn đóng gói toàn bộ code
// vào 1 bundle như cũ (RN không tách bundle theo network như web), NHƯNG
// phần THÂN module của từng trang chỉ được evaluate khi trang đó thật sự
// được render lần đầu — dàn trải chi phí ra theo từng lần người dùng mở
// trang đó, thay vì dồn hết vào 1 lần tại thời điểm AppDrawer mount. Bắt
// buộc phải có <Suspense> bao quanh (dùng chung qua withSuspense.js).
import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import CustomDrawerContent from "./CustomDrawerContent";
import AppHeader from "./AppHeader";
import { withProtection } from "./ProtectedScreen";
import withSuspense from "./withSuspense";
import { NAV } from "./navConfig";
import { makePlaceholder } from "../pages/PlaceholderPage";

const HomePage = React.lazy(() => import("../pages/HomePage"));
const CashFlowPage = React.lazy(() => import("../pages/CashFlow"));
const CustomersPage = React.lazy(() => import("../pages/Customers"));
const IngredientsPage = React.lazy(() => import("../pages/IngredientsPage"));
const MenuPage = React.lazy(() => import("../pages/MenuPage"));
const FruitPage = React.lazy(() => import("../pages/FruitPage"));
const OnlineOrdersPage = React.lazy(() => import("../pages/OnlineOrdersPage"));
const StoragePage = React.lazy(() => import("../pages/StoragePage"));
const VoucherPage = React.lazy(() => import("../pages/VoucherPage"));
const OrdersPage = React.lazy(() => import("../pages/OrdersPage"));
const KitchenPage = React.lazy(() => import("../pages/KitchenPage"));
const AnalystPage = React.lazy(() => import("../pages/AnalystPage"));

const Drawer = createDrawerNavigator();
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
  Orders: OrdersPage,
  Kitchen: KitchenPage,
  Analyst: AnalystPage
};
const PROTECTED_SCREENS = NAV.map(({ screen, label, roles }) => {
  const RawComponent = SCREEN_COMPONENTS[screen] ?? makePlaceholder(label);
  return { screen, label, Component: withSuspense(withProtection(RawComponent, { allowedRoles: roles })) };
});

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
      {PROTECTED_SCREENS.map(({ screen, label, Component }) => (
        <Drawer.Screen key={screen} name={screen} component={Component} options={{ title: label }} />
      ))}
    </Drawer.Navigator>
  );
}
