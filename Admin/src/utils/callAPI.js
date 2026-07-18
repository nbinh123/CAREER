// utils/callAPI.js

import axios from "axios";
import { API_URL } from "../config/api";

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

        const token =
            localStorage.getItem("token");

        if (token) {
            config.headers.Authorization =
                `Bearer ${token}`;
        }

        return config;
    },

    (error) => Promise.reject(error)
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