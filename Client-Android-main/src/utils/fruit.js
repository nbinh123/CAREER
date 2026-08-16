// Y hệt bản web (src/utils/fruit.js) — thuần logic, không đụng DOM nên copy
// nguyên 100%. Hằng số FRUIT_COMBO_PRICE PHẢI khớp giá trị phía server
// (initSocket.js) — đổi ở đây là đổi toàn bộ.
export const FRUIT_COMBO_PRICE = 35000;

export const MIX_CATEGORY = "Trái cây mix";

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

export function parseComboParts(foodName) {
  return (foodName || "")
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function namesMatch(a, b) {
  return normalizeText(a) === normalizeText(b);
}

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

export function isComboFoodItem(food, fruitItems) {
  if (extractCatName(food.categoryId) === MIX_CATEGORY) return true;

  const parts = parseComboParts(food.foodName);
  if (parts.length !== 3) return false;
  const fruitNameSet = new Set((fruitItems || []).map((f) => normalizeText(f.fruitName)));
  return parts.every((part) => fruitNameSet.has(normalizeText(part)));
}

export function findMatchingCombos(combos, selectedNames) {
  if (!selectedNames || selectedNames.length === 0) return [];
  return (combos || []).filter((combo) =>
    selectedNames.every((name) => combo.comboParts.some((part) => namesMatch(part, name)))
  );
}

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
