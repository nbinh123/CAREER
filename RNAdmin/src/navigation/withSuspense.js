// src/navigation/withSuspense.js
// [PERF] HOC dùng chung để bọc <Suspense> quanh 1 screen component —
// bắt buộc phải có khi component đó (hoặc component con của nó) được tạo
// bằng React.lazy(). Tách riêng ra đây để AppDrawer.js và RootNavigator.js
// không phải lặp lại cùng 1 đoạn <Suspense fallback={...}>...</Suspense>.
import React, { Suspense } from "react";
import ScreenLoader from "../components/ScreenLoader";

export default function withSuspense(Component) {
  return function SuspendedScreen(props) {
    return (
      <Suspense fallback={<ScreenLoader />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
