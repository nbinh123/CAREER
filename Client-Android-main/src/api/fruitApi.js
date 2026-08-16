import axiosClient from "./axiosClient";

export async function getFruits() {
  const res = await axiosClient.get("/api/fruits");
  return res.data?.data ?? [];
}

export async function getTopFruitCombos(limit = 6) {
  const res = await axiosClient.get("/api/fruit-orders/top-combos", { params: { limit } });
  return res.data?.data ?? [];
}

// Bản web gọi thẳng fetch() tới /api/fruits/combo ở FruitPage.jsx thay vì
// qua axiosClient — gộp lại vào đây cho nhất quán với các hàm api khác của
// bộ RN này (hành vi/endpoint giữ nguyên, chỉ đổi cách gọi).
export async function getComboFoods() {
  const res = await axiosClient.get("/api/fruits/combo");
  return res.data?.data ?? [];
}
