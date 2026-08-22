// src/utils/socket.js
// [GIU-NGUYEN logic] Giữ nguyên 100% cấu hình io(...) — chỉ đổi nguồn
// API_URL sang bản Expo. Cùng 1 instance singleton dùng chung toàn app,
// y hệt tinh thần bản gốc: mọi trang (OrdersPage, KitchenPage, chat...)
// import chung file này, KHÔNG tự gọi io() riêng.
//
// Đã xác nhận (0.12): socket.io-client chạy được trên Expo/RN runtime với
// transport "websocket". Nếu dùng Expo Go, đảm bảo backend cho phép CORS/
// origin từ thiết bị thật (không phải localhost) khi test trên điện thoại.
import { io } from "socket.io-client";
import { API_URL } from "../config/api";

const socket = io(API_URL, {
  transports: ["websocket"],
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  autoConnect: true,
});

export default socket;
