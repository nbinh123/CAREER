// src/service/IngredientService.js
// [GIU-NGUYEN] Copy nguyên vẹn 100% — thuần logic gọi API, không có gì
// platform-specific (không có upload ảnh cho nguyên liệu).
import { getData, postData, putData, deleteData } from "../utils/callAPI";

const toPayload = (ingredient) => ({
  ingredientName: ingredient.ingredientName,
  quantity: ingredient.quantity,
  smallUnit: ingredient.smallUnit,
  largeUnit: ingredient.largeUnit,
  pricePerLargeUnit: ingredient.pricePerLargeUnit,
  expiryDays: ingredient.expiryDays,
  displayOrder: ingredient.displayOrder,
  note: ingredient.note,
  needContinuousRestock: ingredient.needContinuousRestock,
});

const unwrap = (res) => {
  if (!res.success) {
    const err = new Error(res.message || "Request thất bại");
    err.status = res.status;
    err.data = res.data;
    throw err;
  }
  return res.data;
};

export default class IngredientService {
  static async getAllIngredients() {
    const res = await getData({ url: "/ingredients" });
    return unwrap(res);
  }

  static async getIngredientById(id) {
    const res = await getData({ url: `/ingredients/${id}` });
    return unwrap(res);
  }

  static async createIngredient(ingredient) {
    const res = await postData({ url: "/ingredients", data: toPayload(ingredient) });
    return unwrap(res);
  }

  static async updateIngredient(ingredient) {
    const id = ingredient._id ?? ingredient.id;
    const res = await putData({ url: `/ingredients/${id}`, data: toPayload(ingredient) });
    return unwrap(res);
  }

  static async deleteIngredient(id) {
    const res = await deleteData({ url: `/ingredients/${id}` });
    return unwrap(res);
  }
}
