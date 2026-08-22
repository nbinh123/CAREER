// src/service/FoodService.js
// [GIU-NGUYEN] Giữ nguyên toàn bộ logic buildPayload/unwrap. Riêng uploadRaw:
//   - Đổi localStorage.getItem("token") → useAuthZustand.getState().accessToken
//     (đồng bộ cách lấy token với callAPI.js, theo đúng quyết định trong
//     progress.md — bản web gốc đọc sai key "token" thay vì khớp với store
//     "auth-storage", đây là điểm platform-adaptation được yêu cầu sửa).
//   - fetch() + FormData: React Native's global fetch/FormData ĐÃ hỗ trợ sẵn
//     multipart upload với object { uri, name, type } (đúng shape trả về từ
//     expo-image-picker) — không cần đổi logic buildPayload, chỉ cần đảm bảo
//     ImageUploadField (Giai đoạn 4) tạo object đúng shape này.
import { getData, postData, putData, deleteData, patchData } from "../utils/callAPI";
import { API_URL } from "../config/api";
import useAuthZustand from "../zustand/useAuthZustand";

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
  const clean = Object.fromEntries(Object.entries(food).filter(([k]) => !INTERNAL_ONLY_KEYS.has(k)));

  if (!imageFile) return clean;

  const fd = new FormData();
  for (const [k, v] of Object.entries(clean)) {
    if (v == null) continue;
    if (k === "image") continue;
    fd.append(k, k === "ingredients" ? JSON.stringify(v) : v);
  }
  // imageFile ở RN có shape { uri, name, type } (từ expo-image-picker) thay
  // vì File object của web — FormData.append trên RN nhận trực tiếp object
  // này và tự dựng multipart part đúng chuẩn.
  fd.append("image", imageFile);
  return fd;
}

// ─── Upload ảnh qua fetch thuần ─────────────────────────────────────────────
// Bypass hẳn axios giống bản gốc — fetch không dính default headers toàn cục
// nên FormData luôn được gửi đúng multipart/form-data; boundary=... miễn
// KHÔNG tự set Content-Type ở đây.
const uploadRaw = async (method, url, formData) => {
  const token = useAuthZustand.getState().accessToken;
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

const FoodService = {
  getAllFoods: () => getData({ url: "/foods" }).then(unwrap),

  getFoodById: (id) => getData({ url: `/foods/${id}` }).then(unwrap),

  createFood: (food, imageFile = null) => {
    const payload = buildPayload(food, imageFile);
    if (payload instanceof FormData) {
      return uploadRaw("POST", "/foods", payload);
    }
    return postData({ url: "/foods", data: payload }).then(unwrap);
  },

  updateFood: (food, imageFile = null) => {
    const id = food._id ?? food.id;
    const payload = buildPayload(food, imageFile);
    if (payload instanceof FormData) {
      return uploadRaw("PUT", `/foods/${id}`, payload);
    }
    return putData({ url: `/foods/${id}`, data: payload }).then(unwrap);
  },

  deleteFood: (id) => deleteData({ url: `/foods/${id}` }).then(unwrap),

  searchFoods: (params = {}) => getData({ url: "/foods/search", params }).then(unwrap),

  refreshIngredientPrices: () => patchData({ url: "/foods/refresh-cost" }).then(unwrap),
};

export default FoodService;
