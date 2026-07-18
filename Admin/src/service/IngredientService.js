import { getData, postData, putData } from "../utils/callAPI";

// Lấy đúng những field mà controller destructure trong create / update
// (tránh gửi _id, __v, createdAt, ... dư thừa lên server)
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

export default class IngredientService {

    // GET /api/ingredients  →  controller.getAll
    // Trả về mảng đã sort theo displayOrder (server lo)
    static async getAllIngredients() {
        return getData({ url: "/ingredients" }).then(res => res.data);
    }

    // GET /api/ingredients/:id  →  controller.getOrderById  (param: orderId)
    // Note: controller dùng req.params.orderId nên route phải đăng ký /:orderId
    // Nếu route bạn đăng ký là /:id thì đổi lại URL cho khớp
    static async getIngredientById(id) {
        return getData({ url: `/ingredients/${id}` }).then(res => res.data);
    }

    // POST /api/ingredients  →  controller.create
    // Body: { ingredientName, quantity, smallUnit, largeUnit,
    //         pricePerLargeUnit, expiryDays, displayOrder, note,
    //         needContinuousRestock }
    // Trả về ingredient vừa được tạo (có _id từ MongoDB)
    static async createIngredient(ingredient) {
        return postData({ url: "/ingredients", data: toPayload(ingredient) })
    }

    // PUT /api/ingredients/:id  →  controller.update  (param: id)
    // Body: tương tự create
    // Trả về ingredient đã được cập nhật (option { new: true })
    static async updateIngredient(ingredient) {
        const id = ingredient._id ?? ingredient.id;
        return putData({ url: `/ingredients/${id}`, data: toPayload(ingredient) })
    }

    // DELETE /api/ingredients/:id  →  controller.delete  (param: id)
    // Trả về { message: "Ingredient deleted successfully" }
    static async deleteIngredient(id) {
        return getData({ url: `/ingredients/${id}` }, { method: "DELETE" }).then(res => res.data);
    }
}