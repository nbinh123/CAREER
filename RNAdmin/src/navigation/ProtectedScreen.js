// src/navigation/ProtectedScreen.js
// Chuyển đổi từ components/ProtectedRoute.js (React Router) sang dạng
// wrapper component dùng trong React Navigation. Giữ đúng 3 tầng điều kiện
// y hệt bản gốc:
//   1. Chưa đăng nhập      → (RootNavigator đã tự gate ở tầng ngoài, nhưng
//                             vẫn kiểm tra lại ở đây cho an toàn/deep-link)
//   2. Đang tạm dừng ca     (!isWorking) → hiện màn Forbidden
//   3. Cần quyền admin mà role khác admin → hiện màn Forbidden
// Khác với web (dùng <Navigate/> để đổi URL), ở đây ta render thẳng nội
// dung Forbidden tại chỗ — tương đương hành vi hiển thị cuối cùng cho người
// dùng, không cần điều hướng vật lý sang 1 route khác.
import React from "react";
import useAuthZustand from "../zustand/useAuthZustand";
import ForbiddenPage from "../pages/ForbiddenPage";

export default function ProtectedScreen({ requireAdmin = false, children }) {
  const { isAuthenticated, currentUser, isWorking } = useAuthZustand();

  if (!isAuthenticated) {
    return <ForbiddenPage reason="unauthenticated" />;
  }

  if (!isWorking) {
    return <ForbiddenPage reason="not-working" />;
  }

  if (requireAdmin && currentUser?.role !== "admin") {
    return <ForbiddenPage reason="forbidden" />;
  }

  return children;
}

/**
 * HOC tiện dụng để bọc 1 screen component trực tiếp khi khai báo
 * Drawer.Screen / Stack.Screen, tránh phải viết wrapper thủ công mỗi nơi.
 * Dùng: <Drawer.Screen name="Ingredients" component={withProtection(IngredientsPage, { requireAdmin: true })} />
 */
export function withProtection(Component, { requireAdmin = false } = {}) {
  return function Protected(props) {
    return (
      <ProtectedScreen requireAdmin={requireAdmin}>
        <Component {...props} />
      </ProtectedScreen>
    );
  };
}
