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
// Đổi sang import động (qua lazyScreen()): Metro vẫn đóng gói toàn bộ code
// vào 1 bundle như cũ (RN không tách bundle theo network như web), NHƯNG
// phần THÂN module của từng trang chỉ được evaluate khi trang đó thật sự
// được render lần đầu — dàn trải chi phí ra theo từng lần người dùng mở
// trang đó, thay vì dồn hết vào 1 lần tại thời điểm AppDrawer mount.
//
// [BUGFIX] Trước đây dùng React.lazy() + <Suspense> (withSuspense.js).
// Với React 19 + react-native-screens bản mới, đặt <Suspense> trực tiếp ở
// vị trí `component` của Drawer.Screen gây cảnh báo "Can't perform a React
// state update on a component that hasn't mounted yet" mỗi khi Promise của
// React.lazy() resolve đúng lúc SceneView đang chuyển màn hình (lỗi tương
// thích đã biết giữa Suspense và SceneView, không phải do trang tự setState
// sai chỗ). lazyScreen() tự làm việc tương đương bằng useState/useEffect +
// import() động, không đụng tới Suspense nên tránh được đúng pattern đó —
// xem chi tiết trong lazyScreen.js.
import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import CustomDrawerContent from "./CustomDrawerContent";
import AppHeader from "./AppHeader";
import { withProtection } from "./ProtectedScreen";
import lazyScreen from "./lazyScreen";
import { NAV } from "./navConfig";
import { makePlaceholder } from "../pages/PlaceholderPage";

const HomePage = lazyScreen(() => import("../pages/HomePage"));
const CashFlowPage = lazyScreen(() => import("../pages/CashFlow"));
const CustomersPage = lazyScreen(() => import("../pages/Customers"));
const IngredientsPage = lazyScreen(() => import("../pages/IngredientsPage"));
const MenuPage = lazyScreen(() => import("../pages/MenuPage"));
const FruitPage = lazyScreen(() => import("../pages/FruitPage"));
const OnlineOrdersPage = lazyScreen(() => import("../pages/OnlineOrdersPage"));
const StoragePage = lazyScreen(() => import("../pages/StoragePage"));
const VoucherPage = lazyScreen(() => import("../pages/VoucherPage"));
const OrdersPage = lazyScreen(() => import("../pages/OrdersPage"));
const KitchenPage = lazyScreen(() => import("../pages/KitchenPage"));
const AnalystPage = lazyScreen(() => import("../pages/AnalystPage"));

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
  return { screen, label, Component: withProtection(RawComponent, { allowedRoles: roles }) };
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
