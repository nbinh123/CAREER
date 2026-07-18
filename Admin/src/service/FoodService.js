import { getData, postData, putData, deleteData, patchData } from "../utils/callAPI";

/**
 * Nếu có imageFile → multipart/form-data; không → JSON.
 * ingredients luôn được serialize thành JSON string khi dùng FormData.
 */
function buildPayload(food, imageFile) {
    if (!imageFile) return food;

    const fd = new FormData();
    for (const [k, v] of Object.entries(food)) {
        if (v == null) continue;
        fd.append(k, k === "ingredients" ? JSON.stringify(v) : v);
    }
    fd.append("image", imageFile);
    return fd;
}

const FoodService = {

    // GET /api/foods
    getAllFoods: () =>
        getData({ url: "/foods" }).then(res => res.data),

    // GET /api/foods/:id
    getFoodById: (id) =>
        getData({ url: `/foods/${id}` }).then(res => res.data),

    // POST /api/foods
    createFood: (food, imageFile = null) =>
        postData({
            url: "/foods",
            data: buildPayload(food, imageFile), // ✅ data nằm trong object, không wrap thêm
        }),

    // PUT /api/foods/:id
    updateFood: (food, imageFile = null) => {
        const id = food._id ?? food.id;
        return putData({
            url: `/foods/${id}`,
            data: buildPayload(food, imageFile), // ✅ data nằm trong object, không wrap thêm
        });
    },

    // DELETE /api/foods/:id
    deleteFood: (id) =>
        deleteData({ url: `/foods/${id}` }).then(res => res.data), // ✅ đúng method

    // GET /api/foods/search?name=...&categoryId=...
    searchFoods: (params = {}) =>
        getData({ url: "/foods/search", params }).then(res => res.data), // ✅ params trong object
    refreshIngredientPrices: () =>
        patchData({ url: "/foods/refresh-cost" }),
};

export default FoodService;