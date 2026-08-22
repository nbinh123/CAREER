import axios from "axios";
import { API_URL } from "../config/api";
import { resetToLogin } from "../navigation/navigationRef";
const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

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
    if (axios.isCancel(error) || error.code === "ERR_CANCELED") {
      return { success: false, cancelled: true, status: 0, message: "", data: null };
    }

    return {
      success: false,
      status: error.response?.status || 500,
      message: error.response?.data?.message || error.message || "Có lỗi xảy ra",
      data: error.response?.data || null,
    };
  }
};
export const getData = ({ url, params = {}, headers = {}, signal }) => {
  return handleResponse(api.get(url, { params, headers, signal }));
};

export const postData = ({ url, data = {}, headers = {}, signal }) => {
  return handleResponse(api.post(url, data, { headers, signal }));
};

export const putData = ({ url, data = {}, headers = {}, signal }) => {
  return handleResponse(api.put(url, data, { headers, signal }));
};

export const deleteData = ({ url, params = {}, headers = {}, signal }) => {
  return handleResponse(api.delete(url, { params, headers, signal }));
};

export const patchData = ({ url, data = {}, headers = {}, signal }) => {
  return handleResponse(api.patch(url, data, { headers, signal }));
};

export default api;