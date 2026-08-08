import React from "react";
import { Routes, Route } from "react-router-dom";
import MenuPage from "../../pages/MenuPage";
import FruitPage from "../../pages/FruitPage";
import OrdersPage from "../../pages/OrdersPage";
import NotFoundPage from "../../pages/NotFoundPage";
import { ROUTES } from "../../constants/routes";

// Không còn TableGuard bọc ngoài — mọi route ở đây dùng được ngay, không cần
// xác thực mã bàn/QR nào trước.
export default function Body() {
  return (
    <Routes>
      <Route path={ROUTES.MENU} element={<MenuPage />} />
      <Route path={ROUTES.FRUITS} element={<FruitPage />} />
      <Route path={ROUTES.ORDERS} element={<OrdersPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
