import { getData, postData, putData, deleteData } from "../utils/callAPI";

// Lấy đúng những field mà controller destructure trong create / update
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

// handleResponse() trong callAPI.js không bao giờ reject —
// luôn resolve về { success, data, status, message }.
// unwrap() ở đây chịu trách nhiệm biến "success: false" thành
// một Promise bị reject thật sự, để Promise.allSettled ở
// useIngredientZustand hoạt động đúng như đã viết.
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

    // GET /api/ingredients
    static async getAllIngredients() {
        const res = await getData({ url: "/ingredients" });
        return unwrap(res);
    }

    // GET /api/ingredients/:id
    static async getIngredientById(id) {
        const res = await getData({ url: `/ingredients/${id}` });
        return unwrap(res);
    }

    // POST /api/ingredients
    static async createIngredient(ingredient) {
        const res = await postData({ url: "/ingredients", data: toPayload(ingredient) });
        return unwrap(res);
    }

    // PUT /api/ingredients/:id
    static async updateIngredient(ingredient) {
        const id = ingredient._id ?? ingredient.id;
        const res = await putData({ url: `/ingredients/${id}`, data: toPayload(ingredient) });
        return unwrap(res);
    }

    // DELETE /api/ingredients/:id
    static async deleteIngredient(id) {
        const res = await deleteData({ url: `/ingredients/${id}` });
        return unwrap(res);
    }
}