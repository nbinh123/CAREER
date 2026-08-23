import React from "react";
import useAuthZustand from "../zustand/useAuthZustand";
import ForbiddenPage from "../pages/ForbiddenPage";

// [PERM-FIX] Trước đây nhận `requireAdmin` (boolean, nhị phân admin/không-
// admin), tách rời hoàn toàn khỏi mảng `roles` dùng để lọc sidebar trong
// navConfig.js — 2 nguồn dữ liệu độc lập, dễ lệch nhau theo thời gian (đã
// xác nhận lệch thật ở nhiều role: xem ghi chú trong navConfig.js). Đổi
// sang nhận `allowedRoles` (mảng role được phép, hoặc undefined = không
// giới hạn role) để CHỈ CÒN 1 nguồn chân lý duy nhất — `roles` trong NAV —
// vừa quyết định hiển thị sidebar vừa quyết định quyền truy cập thật.
export default function ProtectedScreen({ allowedRoles, children }) {
  const isAuthenticated = useAuthZustand((s) => s.isAuthenticated);
  const currentUser = useAuthZustand((s) => s.currentUser);
  const isWorking = useAuthZustand((s) => s.isWorking);

  if (!isAuthenticated) {
    return <ForbiddenPage reason="unauthenticated" />;
  }

  if (!isWorking) {
    return <ForbiddenPage reason="not-working" />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser?.role)) {
    return <ForbiddenPage reason="forbidden" />;
  }

  return children;
}
export function withProtection(Component, { allowedRoles } = {}) {
  return function Protected(props) {
    return (
      <ProtectedScreen allowedRoles={allowedRoles}>
        <Component {...props} />
      </ProtectedScreen>
    );
  };
}
