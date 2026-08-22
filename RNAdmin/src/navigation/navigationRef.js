// src/navigation/navigationRef.js
// [NEN-MONG] Thay thế cho window.location.href trong bản web (dùng khi
// callAPI.js bắt được lỗi 401 và cần điều hướng người dùng về Login từ bên
// ngoài 1 component React, ví dụ trong axios interceptor). React Navigation
// cung cấp cơ chế "navigate from outside a component" chính thức qua
// createNavigationContainerRef().
import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

/**
 * Reset toàn bộ stack về màn Login — tương đương
 * `window.location.href = "/login"` ở bản web (xoá lịch sử điều hướng cũ
 * để người dùng không back lại được vào trang cần đăng nhập).
 */
export function resetToLogin() {
  if (!navigationRef.isReady()) return;
  navigationRef.resetRoot({
    index: 0,
    routes: [{ name: "Auth", params: { screen: "Login" } }],
  });
}
