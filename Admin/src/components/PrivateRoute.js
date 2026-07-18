import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useGlobal } from "../context/GlobalContext";

/**
 * Bảo vệ các route cần đăng nhập.
 * - Nếu chưa auth → redirect về /login, kèm `?redirect=<trang hiện tại>`
 *   để sau khi login xong có thể quay lại đúng trang.
 * - Nếu đã auth → render children bình thường.
 */
export default function PrivateRoute() {
  const { isAuthenticated } = useGlobal();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ redirect: location.pathname }}
        replace
      />
    );
  }

  return <Outlet />;
}