import React, { useCallback } from "react";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { ActiveRouteProvider, useActiveRoute } from "../context/ActiveRouteContext";
import RootNavigator from "./RootNavigator";

function TrackedContainer() {
  const navigationRef = useNavigationContainerRef();
  const { setRouteName } = useActiveRoute();

  // `getCurrentRoute()` trả về route LÁ đang active sâu nhất (vd khi ở tab
  // Giỏ hàng chưa push gì, lá là "CartScreen" chứ không phải "CartTab" —
  // xem TAB_TITLES trong AppHeader.jsx đã map theo đúng tên lá này).
  const syncRouteName = useCallback(() => {
    setRouteName(navigationRef.getCurrentRoute()?.name ?? null);
  }, [navigationRef, setRouteName]);

  return (
    <NavigationContainer ref={navigationRef} onReady={syncRouteName} onStateChange={syncRouteName}>
      <RootNavigator />
    </NavigationContainer>
  );
}

// Thay thế trực tiếp cho `<NavigationContainer><RootNavigator/></NavigationContainer>`
// cũ ở App.jsx. Bọc thêm ActiveRouteProvider NGOÀI NavigationContainer để cả
// AppHeader (nằm trong RootNavigator, dưới NavigationContainer) lẫn
// TrackedContainer (nơi set giá trị) đều là con cháu của cùng 1 Provider.
export default function NavigationRoot() {
  return (
    <ActiveRouteProvider>
      <TrackedContainer />
    </ActiveRouteProvider>
  );
}
