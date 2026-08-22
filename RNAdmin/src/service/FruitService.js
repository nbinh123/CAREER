// src/service/FruitService.js
// [GIU-NGUYEN] Giữ nguyên toàn bộ logic buildPayload/unwrap. uploadRaw đổi
// y hệt FoodService.js: token đọc từ useAuthZustand thay vì localStorage.
import { getData, postData, putData, deleteData } from "../utils/callAPI";
import { API_URL } from "../config/api";
import useAuthZustand from "../zustand/useAuthZustand";

const unwrap = (res) => {
  if (!res.success) {
    const err = new Error(res.message || "Request thất bại");
    err.status = res.status;
    err.data = res.data;
    throw err;
  }
  return res.data?.data ?? res.data;
};

const INTERNAL_ONLY_KEYS = new Set(["_id", "id", "__isNew"]);

function buildPayload(fruit, imageFile) {
  const clean = Object.fromEntries(Object.entries(fruit).filter(([k]) => !INTERNAL_ONLY_KEYS.has(k)));

  if (!imageFile) return clean;

  const fd = new FormData();
  for (const [k, v] of Object.entries(clean)) {
    if (v == null) continue;
    if (k === "imageUrl") continue;
    fd.append(k, v);
  }
  fd.append("image", imageFile);
  return fd;
}

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

const FruitService = {
  getAllFruits: () => getData({ url: "/fruits" }).then(unwrap),

  getFruitById: (id) => getData({ url: `/fruits/${id}` }).then(unwrap),

  createFruit: (fruit, imageFile = null) => {
    const payload = buildPayload(fruit, imageFile);
    if (payload instanceof FormData) {
      return uploadRaw("POST", "/fruits", payload).then(unwrap);
    }
    return postData({ url: "/fruits", data: payload }).then(unwrap);
  },

  updateFruit: (fruit, imageFile = null) => {
    const id = fruit._id ?? fruit.id;
    const payload = buildPayload(fruit, imageFile);
    if (payload instanceof FormData) {
      return uploadRaw("PUT", `/fruits/${id}`, payload).then(unwrap);
    }
    return putData({ url: `/fruits/${id}`, data: payload }).then(unwrap);
  },

  deleteFruit: (id) => deleteData({ url: `/fruits/${id}` }).then(unwrap),

  searchFruits: (params = {}) => getData({ url: "/fruits/search", params }).then(unwrap),
};

export default FruitService;
