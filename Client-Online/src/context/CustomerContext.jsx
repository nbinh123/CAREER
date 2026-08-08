import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const CustomerContext = createContext(null);

const ID_KEY = "qbm_customer_id"; // định danh ẩn danh, gắn với TRÌNH DUYỆT này (không phải bàn)
const PROFILE_KEY = "qbm_customer_profile"; // tên/SĐT/địa chỉ khách nhập lần gần nhất, để lần sau khỏi gõ lại

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback cho trình duyệt cũ không có crypto.randomUUID
  return `cus_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Bản gọi món tại bàn dùng TableContext (tableId lấy từ QR) + GuestContext
 * (tên/SĐT nhập theo phiên bàn, xoá khi bàn được reset).
 *
 * Bản đặt online không có "bàn" để bám vào, nên đổi hướng: mỗi trình duyệt
 * tự sinh một `customerId` ngẫu nhiên, LƯU LÂU DÀI trong localStorage (khác
 * với sessionStorage của bản gốc — ở đây khách có thể đóng tab, quay lại
 * hôm sau vẫn là cùng một "khách" để xem lại lịch sử đơn của mình).
 *
 * `customerId` này chính là "chìa khoá phòng" mà SocketContext dùng để
 * join vào room `customer:<customerId>` trên server và nhận realtime đúng
 * các đơn của riêng khách đó — tương đương vai trò của tableId ở bản gốc.
 *
 * Ngoài ra context này còn lưu sẵn thông tin (tên, SĐT, địa chỉ) khách đã
 * nhập ở lần đặt gần nhất để tự điền vào form ở lần đặt sau.
 */
export function CustomerProvider({ children }) {
  const [customerId] = useState(() => {
    try {
      const cached = localStorage.getItem(ID_KEY);
      if (cached) return cached;
    } catch {
      /* localStorage không khả dụng (chế độ riêng tư nghiêm ngặt...) */
    }
    const id = generateId();
    try {
      localStorage.setItem(ID_KEY, id);
    } catch {
      /* bỏ qua, id vẫn dùng được trong phiên hiện tại */
    }
    return id;
  });

  const [profile, setProfile] = useState(null); // { name, phone, address } | null

  useEffect(() => {
    try {
      const cached = localStorage.getItem(PROFILE_KEY);
      if (cached) setProfile(JSON.parse(cached));
    } catch {
      /* dữ liệu hỏng -> coi như chưa có, khách nhập lại là được */
    }
  }, []);

  const saveProfile = useCallback((next) => {
    const clean = {
      name: (next.name || "").trim(),
      phone: (next.phone || "").trim(),
      address: (next.address || "").trim(),
    };
    setProfile(clean);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
    } catch {
      /* không lưu được thì lần sau khách nhập lại, không chặn luồng đặt hàng */
    }
  }, []);

  const value = useMemo(
    () => ({ customerId, profile, saveProfile }),
    [customerId, profile, saveProfile]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer phải dùng trong CustomerProvider");
  return ctx;
}
