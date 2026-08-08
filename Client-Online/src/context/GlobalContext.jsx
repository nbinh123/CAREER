import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

const GlobalContext = createContext(null);

export const RESTAURANT = {
  name: "Quán Nguyên Bình",
  tagline: "Nguyên Bình nấu ăn ngon nhất thế giới",
};

export function GlobalProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, tone }

  const showToast = useCallback((message, tone = "default") => {
    setToast({ message, tone, key: Date.now() });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const value = useMemo(() => ({ restaurant: RESTAURANT, toast, showToast }), [toast, showToast]);

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export function useGlobal() {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error("useGlobal phải dùng trong GlobalProvider");
  return ctx;
}
