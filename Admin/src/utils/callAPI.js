// utils/callAPI.js

import axios from "axios";
import { API_URL } from "../config/api";
const useAuthZustand = require("../zustand/useAuthZustand").default;

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

        const token = useAuthZustand.getState().accessToken;

        if (token) {
            config.headers.Authorization =
                `Bearer ${token}`;
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
// Bất kỳ request nào (từ mọi trang, vì tất cả đều đi qua
// instance `api` này) trả về 401 → coi như phiên đăng nhập
// không còn hợp lệ (token hết hạn / bị thu hồi / sai):
//   1. Xoá auth state + localStorage (clearAuth).
//   2. Đưa người dùng về trang đăng nhập.
// Bỏ qua chính request login (sai mật khẩu cũng trả 401,
// không nên clear/redirect trong trường hợp đó — trang login
// tự xử lý message lỗi bằng field `success` như thường lệ).
api.interceptors.response.use(
    (response) => response,

    (error) => {

        const status = error.response?.status;
        const requestUrl = error.config?.url || "";
        const isLoginRequest = requestUrl.includes("/auth/login") || requestUrl.includes("/login");

        if (status === 401 && !isLoginRequest) {

            useAuthZustand.getState().clearAuth();

            if (
                typeof window !== "undefined" &&
                window.location.pathname !== "/login"
            ) {
                window.location.href = "/login";
            }
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

            status:
                error.response?.status || 500,

            message:
                error.response?.data?.message ||
                error.message ||
                "Có lỗi xảy ra",

            data:
                error.response?.data || null,
        };
    }
};

// ======================================================
// GET
// ======================================================

export const getData = ({
    url,
    params = {},
    headers = {},
}) => {

    return handleResponse(
        api.get(url, {
            params,
            headers,
        })
    );
};

// ======================================================
// POST
// ======================================================

export const postData = ({
    url,
    data = {},
    headers = {},
}) => {

    return handleResponse(
        api.post(url, data, {
            headers,
        })
    );
};

// ======================================================
// PUT
// ======================================================

export const putData = ({
    url,
    data = {},
    headers = {},
}) => {

    return handleResponse(
        api.put(url, data, {
            headers,
        })
    );
};

// ======================================================
// DELETE
// ======================================================

export const deleteData = ({
    url,
    params = {},
    headers = {},
}) => {

    return handleResponse(
        api.delete(url, {
            params,
            headers,
        })
    );
};

// ======================================================
// PATCH
// ======================================================

export const patchData = ({
    url,
    data = {},
    headers = {},
}) => {

    return handleResponse(
        api.patch(url, data, {
            headers,
        })
    );
};

export default api;