// src/navigation/lazyScreen.js
// [BUGFIX] Thay thế cho cặp React.lazy() + <Suspense> (withSuspense.js) từng
// dùng để defer evaluate module của 12 trang + 10 chart (xem ghi chú
// [PERF-FIX] trong AppDrawer.js / RootNavigator.js).
//
// LÝ DO ĐỔI: Khi Suspense được đặt NGAY TẠI vị trí `component` của
// Drawer.Screen / Stack.Screen (tức là con trực tiếp của SceneView do
// react-navigation dựng ra), react-native-screens (bản mới, dùng với React
// 19 / RN 0.86) có 1 lỗi tương thích đã biết: khi Promise của React.lazy()
// resolve, React cố cập nhật state nội bộ của SceneView để thay fallback
// bằng component thật, nhưng cờ "đã mount" phía native của react-native-
// screens đôi khi chưa kịp bật lên trong đúng khung hình đó → React ném ra
// cảnh báo "Can't perform a React state update on a component that hasn't
// mounted yet." (xem software-mansion/react-native-screens#2876 và
// expo/expo#35224 — cả 2 đều xác nhận: bỏ Suspense là hết cảnh báo).
//
// Đây là lỗi ở TẦNG react-native-screens/SceneView, không phải do code
// nghiệp vụ gọi setState sai chỗ trong AnalystPage.js/HomePage.js (2 file
// đó vẫn setState đúng chuẩn, bên trong useEffect như thường lệ).
//
// GIẢI PHÁP: Tự làm 1 bản "lazy" đơn giản bằng useState + useEffect +
// import() động, KHÔNG dùng React.lazy/Suspense — vẫn giữ nguyên đặc tính
// chỉ evaluate thân module của trang khi nó thật sự render lần đầu (đúng
// mục tiêu ban đầu của [PERF-FIX]), nhưng phần "chờ rồi thay thế nội dung"
// giờ nằm hẳn trong 1 component JS bình thường, không còn là con trực tiếp
// của SceneView nữa — tránh đúng cái pattern gây lỗi.
import React, { useEffect, useState } from "react";
import ScreenLoader from "../components/ScreenLoader";

// Cache theo từng factory (mỗi trang gọi lazyScreen() đúng 1 lần lúc định
// nghĩa route, nên factory là key ổn định) — quay lại trang đã từng mở
// trước đó sẽ nhận component ngay từ cache, không hiện loader lại.
const resolvedCache = new WeakMap();

export default function lazyScreen(factory) {
  return function LazyScreen(props) {
    const [Comp, setComp] = useState(() => resolvedCache.get(factory) ?? null);

    // Giống pattern isMounted đã dùng ở HomePage.js: chỉ setState nếu effect
    // này chưa bị cleanup (màn hình chưa bị rời đi/unmount trước khi
    // import() kịp resolve).
    useEffect(() => {
      if (Comp) return;
      let cancelled = false;
      factory().then((mod) => {
        if (cancelled) return;
        const Resolved = mod.default;
        resolvedCache.set(factory, Resolved);
        setComp(() => Resolved);
      });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [Comp]);

    if (!Comp) return <ScreenLoader />;
    return <Comp {...props} />;
  };
}
