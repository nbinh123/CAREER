// Tên route dùng cho React Navigation (khác bản web dùng path URL). Đặt tên
// khớp với cấu trúc Main Tab Navigator đã dựng ở giai đoạn 4 (mục 5.1 kế
// hoạch): Menu, Combo trái cây, Giỏ hàng, Đơn hàng, Tài khoản.
//
// ⚠️ Nếu bạn đã đặt tên route khác ở navigator lúc làm giai đoạn 4, đổi lại
// các giá trị bên dưới cho khớp — mọi screen trong bộ file này chỉ dùng qua
// các hằng số này, không hard-code chuỗi tên route ở nơi khác.
export const ROUTES = {
  TAB_MENU: "MenuTab",
  TAB_FRUITS: "FruitsTab",
  TAB_CART: "CartTab",
  TAB_ORDERS: "OrdersTab",
  TAB_ACCOUNT: "AccountTab",

  CART_SCREEN: "CartScreen",
  CHECKOUT_SCREEN: "CheckoutScreen",

  // Auth Stack (bản chạy độc lập, không có sẵn dự án Giai đoạn 4).
  AUTH_LOGIN: "Login",
  AUTH_REGISTER: "Register",
};
