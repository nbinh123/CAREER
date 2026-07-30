import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useTable } from "./TableContext";

const GuestContext = createContext(null);
const STORAGE_KEY = "qbm_guest_session";

/**
 * Lưu tên + số điện thoại khách nhập trước khi vào thực đơn, gắn với đúng
 * phiên bàn hiện tại (tableId) qua sessionStorage — cùng cơ chế với
 * TableContext, để khách không phải nhập lại nếu chỉ refresh trang.
 *
 * Nếu tableId đổi (hiếm khi xảy ra trong 1 tab) hoặc bàn vừa được server
 * báo "chat_cleared" (admin đã thanh toán, chuẩn bị đón khách mới), thông
 * tin khách cũ sẽ bị xoá — TableGuard sẽ tự động bắt nhập lại vì `hasGuest`
 * quay về false.
 */
export function GuestProvider({ children }) {
  const { table } = useTable();
  const tableId = table?.tableId ?? null;
  const [guest, setGuest] = useState(null); // { name, phone } | null

  useEffect(() => {
    if (!tableId) {
      setGuest(null);
      return;
    }
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.tableId === tableId && parsed?.name && parsed?.phone) {
          setGuest({ name: parsed.name, phone: parsed.phone });
          return;
        }
      }
    } catch {
      /* sessionStorage hỏng/không parse được -> coi như chưa có thông tin */
    }
    setGuest(null);
  }, [tableId]);

  const submitGuest = useCallback(
    (name, phone) => {
      if (!tableId) return;
      const cleanName = name.trim();
      const cleanPhone = phone.trim();
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tableId, name: cleanName, phone: cleanPhone }));
      setGuest({ name: cleanName, phone: cleanPhone });
    },
    [tableId]
  );

  // Gọi khi bàn được reset (thanh toán xong) — dọn phiên khách hiện tại để
  // khách tiếp theo ngồi vào bàn này phải nhập lại tên/SĐT của chính họ.
  const clearGuest = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setGuest(null);
  }, []);

  const value = useMemo(
    () => ({ guest, hasGuest: !!guest, submitGuest, clearGuest }),
    [guest, submitGuest, clearGuest]
  );

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}

export function useGuest() {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useGuest phải dùng trong GuestProvider");
  return ctx;
}
