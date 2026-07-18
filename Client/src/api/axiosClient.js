import axios from "axios";

// Đổi qua .env (VITE_API_BASE_URL) khi deploy, mặc định trỏ về server local khi dev
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export default axiosClient;
