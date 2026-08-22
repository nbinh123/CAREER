// src/navigation/navConfig.js
// [UI/NEN-MONG] Chuyển thẳng từ mảng NAV trong pages/SidePage.js — giữ
// đúng field path/label/icon/roles, filter theo currentUser.role y hệt bản
// gốc. `path` được giữ lại (dù RN không dùng URL) chỉ để đối chiếu 1-1 với
// bản gốc và làm key; `screen` mới là tên route thật dùng trong Drawer.
import {
  Home,
  Package,
  UtensilsCrossed,
  ShoppingCart,
  Gift,
  Cherry,
  TrendingUp,
  ChefHat,
  UserCog,
  BarChart3,
  User,
  Ticket,
} from "lucide-react-native";

export const NAV = [
  { screen: "Home", path: "/", label: "Tổng quan", icon: Home, roles: ["admin", "manager", "cashier", "chef", "staff"] },
  { screen: "Ingredients", path: "/ingredients", label: "Nguyên liệu", icon: Package, roles: ["admin"] },
  { screen: "Menu", path: "/menu", label: "Thực đơn", icon: UtensilsCrossed, roles: ["admin"] },
  { screen: "Fruit", path: "/fruit", label: "Trái cây", icon: Cherry, roles: ["admin", "staff"] },
  { screen: "Orders", path: "/orders", label: "Order", icon: ShoppingCart, roles: ["admin", "staff", "chef"] },
  { screen: "Online", path: "/online", label: "Đơn hàng online", icon: ShoppingCart, roles: ["admin"] },
  { screen: "Analyst", path: "/analyst", label: "Phân tích", icon: BarChart3, roles: ["admin"] },
  { screen: "Storage", path: "/storage", label: "Quản lý nhập/xuất", icon: Gift, roles: ["admin"] },
  { screen: "Customers", path: "/customers", label: "Khách hàng", icon: User, roles: ["admin"] },
  { screen: "Voucher", path: "/voucher", label: "Voucher", icon: Ticket, roles: ["admin"] },
  { screen: "StaffManager", path: "/staff-manager", label: "Quản lý nhân viên", icon: UserCog, roles: ["admin"] },
  { screen: "CashFlow", path: "/cash-flow", label: "Dòng tiền", icon: TrendingUp, roles: ["admin"] },
  { screen: "Kitchen", path: "/kitchen", label: "Nhà bếp", icon: ChefHat, roles: ["admin", "chef"] },
];

// ─── Quyền admin theo route (đối chiếu 1-1 với ProtectedRoute isAdmin={...}
// trong App.js gốc — KHÔNG suy ra từ mảng roles ở trên, vì 2 cơ chế này vốn
// độc lập trong bản gốc: `roles` chỉ lọc hiển thị sidebar, còn ProtectedRoute
// mới thật sự chặn truy cập theo nhị phân admin/không-admin. Giữ nguyên độ
// "lỏng" này (VD /fruit isAdmin=false dù roles chỉ liệt kê admin+staff) để
// không thay đổi hành vi nghiệp vụ đã có. ─────────────────────────────────
// isAdmin=true : Ingredients, Menu, Analyst, Register, StaffManager,
//                Storage, CashFlow, Kitchen, Customers, Voucher
// isAdmin=false: Home, Orders, Shift, Fruit, Online
export const ADMIN_ONLY_SCREENS = new Set([
  "Ingredients",
  "Menu",
  "Analyst",
  "Register",
  "StaffManager",
  "Storage",
  "CashFlow",
  "Kitchen",
  "Customers",
  "Voucher",
]);
