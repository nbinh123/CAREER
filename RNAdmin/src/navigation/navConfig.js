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

// [PERM-FIX] Đã xoá ADMIN_ONLY_SCREENS (Set riêng dùng làm cổng requireAdmin
// cho ProtectedScreen). Trước đây danh sách này ĐỘC LẬP với `roles` ở trên,
// và trên thực tế đã LỆCH nhau ở nhiều chỗ — kiểm chứng lại toàn bộ 5 role
// cho thấy:
//   • "Kitchen": roles cho phép chef, nhưng ADMIN_ONLY_SCREENS lại chặn
//     chef (chỉ admin qua được) → chef thấy mục "Nhà bếp" trong sidebar
//     nhưng bấm vào thì dính 403, dù đúng ra phải được vào.
//   • "Online": roles chỉ liệt kê admin (ẩn với mọi role khác trên sidebar),
//     nhưng KHÔNG có trong ADMIN_ONLY_SCREENS → manager/cashier/chef/staff
//     đều gọi navigation.navigate("Online") thẳng là vào được, dù sidebar
//     không hề hiện mục đó cho họ.
//   • "Fruit", "Orders" với role manager/cashier: roles không liệt kê 2
//     role này (ẩn sidebar), nhưng cũng không có trong ADMIN_ONLY_SCREENS
//     → vẫn truy cập thẳng được.
// Giờ AppDrawer.js lấy thẳng `roles` của từng screen trong NAV để truyền
// vào ProtectedScreen làm allowedRoles — chỉ còn 1 nguồn duy nhất, không
// thể lệch nhau nữa.
