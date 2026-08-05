// utils/socket.js
import { io } from "socket.io-client";
import { API_URL } from "../config/api";

// ─── Kết nối socket DUY NHẤT cho toàn app ──────────────────────────────────
// Mọi trang (OrdersPage, KitchenPage, trang khách gọi combo trái cây, ...)
// import CHUNG instance này — KHÔNG tự gọi io(...) riêng ở từng file.
// Nhờ cơ chế cache của ES Module, dù nhiều file cùng import "./utils/socket",
// chỉ có đúng 1 connection thật được tạo ra và sống suốt vòng đời của app.
const socket = io(API_URL, {
  transports: ["websocket"],
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  autoConnect: true,
});

export default socket;