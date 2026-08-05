    import { getData, postData, putData, deleteData, patchData } from "../utils/callAPI";
    import { API_URL } from "../config/api";

    const unwrap = (res) => {
        if (!res.success) {
            const err = new Error(res.message || "Request thất bại");
            err.status = res.status;
            err.data = res.data;
            throw err;
        }
        return res.data;
    };

    const INTERNAL_ONLY_KEYS = new Set(["_id", "id", "__isNew"]);

    function buildPayload(food, imageFile) {
        const clean = Object.fromEntries(
            Object.entries(food).filter(([k]) => !INTERNAL_ONLY_KEYS.has(k))
        );

        if (!imageFile) return clean;

        const fd = new FormData();
        for (const [k, v] of Object.entries(clean)) {
            if (v == null) continue;
            if (k === "image") continue;
            fd.append(k, k === "ingredients" ? JSON.stringify(v) : v);
        }
        fd.append("image", imageFile);
        return fd;
    }

    // ─── Upload ảnh qua fetch thuần ─────────────────────────────────────────────
    // Bypass hẳn axios (kể cả instance riêng lẫn axios.defaults toàn cục) —
    // fetch không có khái niệm default headers dính vào mọi request, nên
    // FormData luôn được gửi đúng multipart/form-data; boundary=... miễn là
    // KHÔNG tự set Content-Type trong headers dưới đây.
    const uploadRaw = async (method, url, formData) => {
        const token = localStorage.getItem("token");
        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        console.log("[uploadRaw] calling fetch:", { method, url: `${API_URL}/api${url}`, headers });
        console.log("[uploadRaw] formData entries:", [...formData.entries()]);

        let response;
        try {
            response = await fetch(`${API_URL}/api${url}`, {
                method,
                headers,
                body: formData,
            });
        } catch (networkErr) {
            console.error("[uploadRaw] fetch network error:", networkErr);
            throw new Error(networkErr.message || "Lỗi kết nối tới server");
        }

        console.log("[uploadRaw] response status:", response.status, response.ok);

        let data = null;
        try {
            data = await response.json();
            console.log("[uploadRaw] response data:", data);
        } catch (parseErr) {
            console.error("[uploadRaw] failed to parse response json:", parseErr);
        }

        if (!response.ok) {
            const err = new Error(data?.message || data?.error || `HTTP ${response.status}`);
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return data;
    };

    const FoodService = {

        getAllFoods: () =>
            getData({ url: "/foods" }).then(unwrap),

        getFoodById: (id) =>
            getData({ url: `/foods/${id}` }).then(unwrap),

        // POST /api/foods
        createFood: (food, imageFile = null) => {
            const payload = buildPayload(food, imageFile);
            if (payload instanceof FormData) {
                return uploadRaw("POST", "/foods", payload);
            }
            return postData({ url: "/foods", data: payload }).then(unwrap);
        },

        // PUT /api/foods/:id
        updateFood: (food, imageFile = null) => {
            const id = food._id ?? food.id;
            const payload = buildPayload(food, imageFile);
            if (payload instanceof FormData) {
                return uploadRaw("PUT", `/foods/${id}`, payload);
            }
            return putData({ url: `/foods/${id}`, data: payload }).then(unwrap);
        },

        deleteFood: (id) =>
            deleteData({ url: `/foods/${id}` }).then(unwrap),

        searchFoods: (params = {}) =>
            getData({ url: "/foods/search", params }).then(unwrap),

        refreshIngredientPrices: () =>
            patchData({ url: "/foods/refresh-cost" }).then(unwrap),
    };

    export default FoodService;