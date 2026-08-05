import axiosClient from "./axiosClient";

// GET /api/fruits -> { success, data: Fruit[] } — endpoint riêng cho trái
// cây (Fruit collection), TÁCH BIỆT hoàn toàn khỏi /api/foods. Trái cây
// không còn là Food document nữa, nên không lọc/liên quan gì tới OrderPage.
export async function getFruits() {
  const res = await axiosClient.get("/api/fruits");
  return res.data?.data ?? [];
}

// GET /api/fruit-orders/top-combos -> { success, data: TopCombo[] }
// TopCombo = { comboKey, fruits: [{fruitId,fruitName,originalPrice,imageUrl}] x3, orderCount, totalQuantity }
// Dùng để gợi ý "combo bán chạy nhất" — tính từ lịch sử đơn thật (xem
// FruitOrderController.js), không phải combo định sẵn trong menu.
export async function getTopFruitCombos(limit = 6) {
  const res = await axiosClient.get("/api/fruit-orders/top-combos", { params: { limit } });
  return res.data?.data ?? [];
}
