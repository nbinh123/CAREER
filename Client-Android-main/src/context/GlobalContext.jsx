import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

const GlobalContext = createContext(null);

// Giữ nguyên tên/tagline từ bản web (src/context/GlobalContext.jsx). Tên
// chính thức của app vẫn là 1 trong 3 câu hỏi mở ở mục 8 kế hoạch — khi có
// câu trả lời, đổi ở ĐÚNG 1 chỗ này (và app.json/app.config.js cho tên
// hiển thị ngoài Home Screen).
export const RESTAURANT = {
  name: "NFood",
  tagline: "Đồ ăn ngon hơn người yêu cũ của bạn",
};

export function GlobalProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, tone, key }

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
