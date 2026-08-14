import { getData, postData, putData, deleteData } from "../utils/callAPI";
import { API_URL } from "../config/api";

const unwrap = (res) => {
    if (!res.success) {
        const err = new Error(res.message || "Request thất bại");
        err.status = res.status;
        err.data = res.data;
        throw err;
    }
    // res.data là body gốc từ server: { success, data }.
    // Bóc thêm 1 tầng .data nữa; fallback về res.data nếu có route nào
    // trả thẳng mảng/object không bọc envelope.
    return res.data?.data ?? res.data;
};

const INTERNAL_ONLY_KEYS = new Set(["_id", "id", "__isNew"]);

function buildPayload(fruit, imageFile) {
    const clean = Object.fromEntries(
        Object.entries(fruit).filter(([k]) => !INTERNAL_ONLY_KEYS.has(k))
    );

    if (!imageFile) return clean;

    const fd = new FormData();
    for (const [k, v] of Object.entries(clean)) {
        if (v == null) continue;
        if (k === "imageUrl") continue; // ảnh cũ — bỏ qua vì đang gửi ảnh mới thay thế
        fd.append(k, v);
    }
    fd.append("image", imageFile);
    return fd;
}

// ─── Upload ảnh qua fetch thuần ─────────────────────────────────────────────
// Bypass hẳn axios giống hệt FoodService.js — fetch không dính default
// headers toàn cục nên FormData luôn được gửi đúng
// multipart/form-data; boundary=... miễn KHÔNG tự set Content-Type ở đây.
const uploadRaw = async (method, url, formData) => {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let response;
    try {
        response = await fetch(`${API_URL}/api${url}`, {
            method,
            headers,
            body: formData,
        });
    } catch (networkErr) {
        throw new Error(networkErr.message || "Lỗi kết nối tới server");
    }

    let data = null;
    try {
        data = await response.json();
    } catch {
        /* response không có JSON body */
    }

    if (!response.ok) {
        const err = new Error(data?.message || data?.error || `HTTP ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
    }

    return data;
};

const FruitService = {
    getAllFruits: () =>
        getData({ url: "/fruits" }).then(unwrap),

    getFruitById: (id) =>
        getData({ url: `/fruits/${id}` }).then(unwrap),

    // POST /api/fruits
    createFruit: (fruit, imageFile = null) => {
        const payload = buildPayload(fruit, imageFile);
        if (payload instanceof FormData) {
            // uploadRaw trả thẳng body gốc { success, data } (không qua lớp
            // bọc của postData) — cần unwrap ở đây để khớp shape trả về với
            // nhánh JSON thường bên dưới (fruit object, không phải envelope).
            return uploadRaw("POST", "/fruits", payload).then(unwrap);
        }
        return postData({ url: "/fruits", data: payload }).then(unwrap);
    },

    // PUT /api/fruits/:id
    updateFruit: (fruit, imageFile = null) => {
        const id = fruit._id ?? fruit.id;
        const payload = buildPayload(fruit, imageFile);
        if (payload instanceof FormData) {
            return uploadRaw("PUT", `/fruits/${id}`, payload).then(unwrap);
        }
        return putData({ url: `/fruits/${id}`, data: payload }).then(unwrap);
    },

    deleteFruit: (id) =>
        deleteData({ url: `/fruits/${id}` }).then(unwrap),

    searchFruits: (params = {}) =>
        getData({ url: "/fruits/search", params }).then(unwrap),
};

export default FruitService;