import { getData, postData, putData, deleteData, patchData } from "../utils/callAPI";

/**
 * handleResponse() trong callAPI.js không bao giờ reject —
 * luôn resolve về { success, data, status, message }.
 * unwrap() biến "success: false" thành Promise bị reject thật,
 * để try/catch và Promise.allSettled trong useFoodZustand hoạt
 * động đúng như đã viết (giống IngredientService).
 */
const unwrap = (res) => {
    if (!res.success) {
        const err = new Error(res.message || "Request thất bại");
        err.status = res.status;
        err.data = res.data;
        throw err;
    }
    return res.data;
};

// Field chỉ tồn tại ở local state (FoodZustand), không được gửi lên server
const INTERNAL_ONLY_KEYS = new Set(["_id", "id", "__isNew"]);

/**
 * Nếu có imageFile → multipart/form-data; không → JSON.
 * ingredients luôn được serialize thành JSON string khi dùng FormData.
 *
 * Lưu ý:
 *  - `_id`/`id`/`__isNew` là field nội bộ của FoodZustand (id tạm dạng
 *    "temp_..." cho món đang staged, cờ đánh dấu món mới) — không được
 *    lọt vào body: id thật đã nằm trong URL (`/foods/:id`), còn id tạm
 *    sẽ khiến Mongo cast lỗi nếu gửi lên khi tạo mới.
 *  - Không append field "image" cũ (URL string còn sót trong state khi
 *    mở form edit) vào FormData nếu đã có imageFile mới, tránh 2 field
 *    "image" đè nhau (1 string, 1 File) trong cùng multipart request.
 */
function buildPayload(food, imageFile) {
    const clean = Object.fromEntries(
        Object.entries(food).filter(([k]) => !INTERNAL_ONLY_KEYS.has(k))
    );

    if (!imageFile) return clean;

    const fd = new FormData();
    for (const [k, v] of Object.entries(clean)) {
        if (v == null) continue;
        if (k === "image") continue; // ảnh mới append riêng bên dưới
        fd.append(k, k === "ingredients" ? JSON.stringify(v) : v);
    }
    fd.append("image", imageFile);
    return fd;
}

const FoodService = {

    // GET /api/foods
    getAllFoods: () =>
        getData({ url: "/foods" }).then(unwrap),

    // GET /api/foods/:id
    getFoodById: (id) =>
        getData({ url: `/foods/${id}` }).then(unwrap),

    // POST /api/foods
    createFood: (food, imageFile = null) =>
        postData({
            url: "/foods",
            data: buildPayload(food, imageFile),
        }).then(unwrap),

    // PUT /api/foods/:id
    updateFood: (food, imageFile = null) => {
        const id = food._id ?? food.id;
        return putData({
            url: `/foods/${id}`,
            data: buildPayload(food, imageFile),
        }).then(unwrap);
    },

    // DELETE /api/foods/:id
    deleteFood: (id) =>
        deleteData({ url: `/foods/${id}` }).then(unwrap),

    // GET /api/foods/search?name=...&categoryId=...
    searchFoods: (params = {}) =>
        getData({ url: "/foods/search", params }).then(unwrap),

    // PATCH /api/foods/refresh-cost
    refreshIngredientPrices: () =>
        patchData({ url: "/foods/refresh-cost" }).then(unwrap),
};

export default FoodService;