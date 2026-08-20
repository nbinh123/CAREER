import React, { useCallback } from "react";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { useActiveRoute } from "../context/ActiveRouteContext";
import RootNavigator from "./RootNavigator";

// ActiveRouteProvider đã được nâng lên App.js (bọc ngoài AppProviders) để
// ChatWidget — mount trong AppProviders, là sibling của NavigationRoot —
// cũng đọc được cùng một Provider. Xem App.js.
//
// `getCurrentRoute()` trả về route LÁ đang active sâu nhất (vd khi ở tab
// Giỏ hàng chưa push gì, lá là "CartScreen" chứ không phải "CartTab" —
// xem TAB_TITLES trong AppHeader.jsx đã map theo đúng tên lá này).
export default function NavigationRoot() {
  const navigationRef = useNavigationContainerRef();
  const { setRouteName } = useActiveRoute();

  const syncRouteName = useCallback(() => {
    setRouteName(navigationRef.getCurrentRoute()?.name ?? null);
  }, [navigationRef, setRouteName]);

  return (
    <NavigationContainer ref={navigationRef} onReady={syncRouteName} onStateChange={syncRouteName}>
      <RootNavigator />
    </NavigationContainer>
  );
}