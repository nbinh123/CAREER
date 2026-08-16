import React, { createContext, useContext, useMemo, useState } from "react";

const ActiveRouteContext = createContext(null);

/**
 * Cầu nối để AppHeader.jsx (mount NGOÀI Tab.Navigator, xem RootNavigator.jsx)
 * biết được tab nào đang active MÀ KHÔNG cần `useNavigationState`.
 *
 * Lý do không dùng thẳng `useNavigationState`/`useNavigation`: 2 hook đó chỉ
 * đọc được `NavigationStateContext` — context này CHỈ được cung cấp bên
 * trong 1 Navigator (Tab.Navigator, Stack.Navigator...) cho chính các màn
 * con của nó, KHÔNG lan ra ngoài tới các component anh em (sibling) như
 * AppHeader. Gọi trực tiếp 2 hook đó ở AppHeader gây lỗi "Couldn't get the
 * navigation state. Is your component inside a navigator?".
 *
 * Giải pháp: theo dõi route hiện tại ở NGOÀI CÙNG, tại chính
 * `<NavigationContainer>` (xem NavigationRoot.jsx) bằng `ref` +
 * `onReady`/`onStateChange`, rồi phát lại qua context phẳng này — ai cũng
 * đọc được, không phụ thuộc việc có nằm trong Navigator hay không.
 */
export function ActiveRouteProvider({ children }) {
  const [routeName, setRouteName] = useState(null);
  const value = useMemo(() => ({ routeName, setRouteName }), [routeName]);
  return <ActiveRouteContext.Provider value={value}>{children}</ActiveRouteContext.Provider>;
}

export function useActiveRoute() {
  const ctx = useContext(ActiveRouteContext);
  if (!ctx) throw new Error("useActiveRoute phải dùng trong ActiveRouteProvider");
  return ctx;
}
