// src/utils/callAPI.js
// [NEN-MONG] Giữ nguyên toàn bộ getData/postData/putData/deleteData/patchData
// và cấu trúc interceptor y hệt bản gốc. Chỉ sửa đúng 2 chỗ platform-specific
// như progress.md đã chốt:
//   1. Interceptor request đọc token từ useAuthZustand.getState().accessToken
//      → giữ nguyên (đã là in-memory state, không đổi).
//   2. Interceptor response khi 401 dùng window.location.href = "/login"
//      → thay bằng resetToLogin() qua navigationRef của React Navigation.
import axios from "axios";
import { API_URL } from "../config/api";
import { resetToLogin } from "../navigation/navigationRef";

// ĐÃ XÓA dòng require ở đây để triệt tiêu hoàn toàn Require Cycle (vòng lặp import).

// ======================================================
// AXIOS INSTANCE
// ======================================================

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ======================================================
// REQUEST INTERCEPTOR
// ======================================================

api.interceptors.request.use(
  (config) => {
    // REQUIRE được chuyển vào đây: Chỉ gọi khi request chuẩn bị bắn đi
    const useAuthZustand = require("../zustand/useAuthZustand").default || require("../zustand/useAuthZustand");
    const token = useAuthZustand.getState().accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },

  (error) => Promise.reject(error)
);

// ======================================================
// RESPONSE INTERCEPTOR — auto-redirect khi 401
// ======================================================
// Bất kỳ request nào (từ mọi trang, vì tất cả đều đi qua instance `api`
// này) trả về 401 → coi như phiên đăng nhập không còn hợp lệ:
//   1. Xoá auth state (clearAuth) — AsyncStorage được dọn bên trong store.
//   2. Đưa người dùng về màn Login bằng navigationRef (thay window.location).
// Bỏ qua chính request login (sai mật khẩu cũng trả 401, trang Login tự xử
// lý message lỗi bằng field `success` như thường lệ).
api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";
    const isLoginRequest = requestUrl.includes("/auth/login") || requestUrl.includes("/login");

    if (status === 401 && !isLoginRequest) {
      // REQUIRE được chuyển vào đây: Chỉ gọi khi API trả về lỗi 401
      const useAuthZustand = require("../zustand/useAuthZustand").default || require("../zustand/useAuthZustand");
      
      useAuthZustand.getState().clearAuth();
      resetToLogin();
    }

    return Promise.reject(error);
  }
);

// ======================================================
// HANDLE RESPONSE
// ======================================================

const handleResponse = async (request) => {
  try {
    const response = await request;

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      message: error.response?.data?.message || error.message || "Có lỗi xảy ra",
      data: error.response?.data || null,
    };
  }
};

// ======================================================
// GET / POST / PUT / DELETE / PATCH
// ======================================================

export const getData = ({ url, params = {}, headers = {} }) => {
  return handleResponse(api.get(url, { params, headers }));
};

export const postData = ({ url, data = {}, headers = {} }) => {
  return handleResponse(api.post(url, data, { headers }));
};

export const putData = ({ url, data = {}, headers = {} }) => {
  return handleResponse(api.put(url, data, { headers }));
};

export const deleteData = ({ url, params = {}, headers = {} }) => {
  return handleResponse(api.delete(url, { params, headers }));
};

export const patchData = ({ url, data = {}, headers = {} }) => {
  return handleResponse(api.patch(url, data, { headers }));
};

export default api;