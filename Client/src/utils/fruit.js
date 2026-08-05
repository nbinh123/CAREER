// Giá cố định cho 1 phần combo trái cây — áp dụng NHƯ NHAU cho cả combo tự
// mix lẫn combo có sẵn trong thực đơn, không cộng dồn giá từng loại trái
// cây nữa. Đổi ở đây là đổi toàn bộ (client + cần khớp với hằng số phía
// server trong initSocket.js).
export const FRUIT_COMBO_PRICE = 35000;

// Danh mục cố định mà FruitPage.js (admin) gắn cho mọi combo trái cây mix
// khi lưu vào bảng Food — đây giờ là dấu hiệu CHÍNH để nhận diện 1 Food
// document có phải combo trái cây hay không, thay vì chỉ đoán qua tên.
export const MIX_CATEGORY = "Trái cây mix";

/** Trích tên danh mục dù categoryId là object populate hay string */
function extractCatName(cat) {
  if (!cat) return "";
  return typeof cat === "object" ? (cat.name ?? "") : cat;
}

export function normalizeText(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Combo có sẵn trong menu = 1 Food document được admin gắn danh mục
// "Trái cây mix" (ở FruitPage.js admin) với foodName liệt kê đúng 3 loại
// trái cây, ngăn cách bằng dấu "-" (VD "Xoài - Ổi - Mận"), và cả 3 phần
// đều khớp tên 1 loại trong Fruit collection hiện tại (fetch từ
// /api/fruits).
export function parseComboParts(foodName) {
  return (foodName || "")
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function namesMatch(a, b) {
  return normalizeText(a) === normalizeText(b);
}

// Lọc trong danh sách Food (toàn bộ /api/foods) ra những món thoả điều
// kiện "combo trái cây có sẵn". Trước đây phải dò TOÀN BỘ /api/foods và
// đoán qua tên (dễ nhầm với món ăn thường vô tình có dấu "-" trong tên).
// Giờ lọc theo categoryId === MIX_CATEGORY trước — đáng tin cậy hơn hẳn vì
// đây là tag admin chủ động gắn ở trang Combo trái cây mix — rồi mới tách
// tên để lấy đúng 3 loại trái cây của combo đó (bảng Food không có field
// liên kết riêng tới Fruit).
export function resolveComboFoods(foodItems, fruitItems) {
  const fruitNameSet = new Set((fruitItems || []).map((f) => normalizeText(f.fruitName)));
  return (foodItems || [])
    .filter((food) => extractCatName(food.categoryId) === MIX_CATEGORY)
    .map((food) => ({ ...food, comboParts: parseComboParts(food.foodName) }))
    .filter(
      (food) =>
        food.comboParts.length === 3 &&
        food.comboParts.every((part) => fruitNameSet.has(normalizeText(part)))
    );
}

// Có phải 1 Food item là combo trái cây có sẵn không — dùng ở OrderPage.jsx
// để loại nó khỏi Thực đơn (chỉ bán qua trang Trái cây). Ưu tiên kiểm tra
// categoryId trước (đúng combo mới tạo từ FruitPage.js admin); phần dò tên
// giữ lại làm fallback cho dữ liệu cũ chưa được gắn categoryId.
export function isComboFoodItem(food, fruitItems) {
  if (extractCatName(food.categoryId) === MIX_CATEGORY) return true;

  const parts = parseComboParts(food.foodName);
  if (parts.length !== 3) return false;
  const fruitNameSet = new Set((fruitItems || []).map((f) => normalizeText(f.fruitName)));
  return parts.every((part) => fruitNameSet.has(normalizeText(part)));
}

// Combo có sẵn nào chứa TẤT CẢ tên trong `selectedNames` (không quan tâm
// thứ tự) — dùng để gợi ý dần khi khách mới chọn 1-2 loại.
export function findMatchingCombos(combos, selectedNames) {
  if (!selectedNames || selectedNames.length === 0) return [];
  return (combos || []).filter((combo) =>
    selectedNames.every((name) => combo.comboParts.some((part) => namesMatch(part, name)))
  );
}

// Combo có sẵn trùng khớp CHÍNH XÁC bộ 3 loại khách đã chọn (không quan
// tâm thứ tự) — dùng để báo "combo này đã có sẵn trong thực đơn".
export function findExactCombo(combos, selectedNames) {
  if (!selectedNames || selectedNames.length !== 3) return null;
  return (
    (combos || []).find(
      (combo) =>
        combo.comboParts.length === 3 &&
        selectedNames.every((name) => combo.comboParts.some((part) => namesMatch(part, name)))
    ) || null
  );
}