// src/config/queryClient.js
// Khởi tạo 1 QueryClient DUY NHẤT dùng chung toàn app (tạo ở module scope,
// không phải trong component, để không bị tạo lại mỗi lần App.js render).
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1, // API đã có interceptor xử lý 401/lỗi ở callAPI.js — không cần retry nhiều lần
            staleTime: 300_000, // mặc định 10s; từng màn hình có thể override riêng (StoragePage.js dùng 15s)
        },
    },
});