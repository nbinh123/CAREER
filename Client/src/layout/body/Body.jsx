import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TableGuard from "../../components/table/TableGuard";
import OrderPage from "../../pages/OrderPage";
import HistoryPage from "../../pages/HistoryPage";
import NotFoundPage from "../../pages/NotFoundPage";
import { ROUTES } from "../../constants/routes";

export default function Body() {
  return (
    <Routes>
      {/* Mọi route trong nhóm này đều yêu cầu đã xác thực mã bàn qua QR */}
      <Route element={<TableGuard />}>
        <Route path={ROUTES.ENTRY} element={<Navigate to={ROUTES.ORDER} replace />} />
        <Route path={ROUTES.ORDER} element={<OrderPage />} />
        <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}