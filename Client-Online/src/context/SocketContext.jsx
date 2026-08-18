import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useCustomer } from "./CustomerContext";
import { useGlobal } from "./GlobalContext";
import { ORDER_STATUS_META } from "../constants/orderStatus";

const SocketContext = createContext(null);

// Đổi qua .env (VITE_SOCKET_URL) khi deploy, mặc định trỏ về server local khi dev.
// Phải khớp với SOCKET_URL cấu hình bên admin/bếp.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function SocketProvider({ children }) {
  const { customerId } = useCustomer();
  const { showToast } = useGlobal();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [stateReceived, setStateReceived] = useState(false);
  const [orders, setOrders] = useState([]); // Order[] thuộc customerId hiện tại, mới nhất trước
  const [messages, setMessages] = useState([]); // tin nhắn chat với quán, cũ -> mới
  const [chatHistoryReceived, setChatHistoryReceived] = useState(false);

  // Dùng để so sánh trạng thái cũ/mới của từng đơn khi "customer_orders_state"
  // bắn lại, từ đó biết đơn NÀO vừa đổi trạng thái để bắn toast — không toast
  // ở lần nhận dữ liệu ĐẦU TIÊN (đó là tải lịch sử, không phải "vừa đổi").
  const prevStatusRef = useRef(new Map()); // orderId -> status
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!customerId) return;

    setChatHistoryReceived(false);
    setMessages([]);

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_customer", { customerId });
    });

    socket.on("disconnect", () => setConnected(false));

    // data: mảng đơn của đúng customerId này (server emit theo room riêng).
    socket.on("customer_orders_state", (data) => {
      const nextOrders = Array.isArray(data) ? data : [];

      if (hasLoadedOnceRef.current) {
        nextOrders.forEach((order) => {
          const prevStatus = prevStatusRef.current.get(order.id);
          if (prevStatus && prevStatus !== order.status) {
            const label = ORDER_STATUS_META[order.status]?.label || order.status;
            showToast(`Đơn #${String(order.id).slice(-6)}: ${label}`, "info");
          }
        });
      }
      prevStatusRef.current = new Map(nextOrders.map((o) => [o.id, o.status]));
      hasLoadedOnceRef.current = true;

      setOrders(nextOrders);
      setStateReceived(true);
    });

    // Lịch sử chat, nạp đúng 1 lần ngay sau khi join phòng.
    socket.on("chat_history", (data) => {
      setMessages(Array.isArray(data) ? data : []);
      setChatHistoryReceived(true);
    });

    // Tin nhắn mới, realtime — từ chính khách (vòng lại để đồng bộ nhiều
    // tab) hoặc admin trả lời. Không cần lọc trùng vì server chỉ bắn 1 lần
    // cho mỗi tin thật sự mới, khác với chat_history (snapshot toàn bộ).
    socket.on("chat_message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("order_voucher_rejected", ({ message } = {}) => {
      showToast(message || "Mã giảm giá không còn hiệu lực, vui lòng thử lại", "error");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // items: mảng cart context [{ id (foodId), name, price, qty }]
  // customerInfo: { name, phone, address, note }
  const placeOrder = useCallback(
    (items, customerInfo, voucherCode) => {
      if (!socketRef.current || !customerId) {
        return Promise.reject(new Error("Chưa kết nối được tới server"));
      }
      if (!items?.length) {
        return Promise.reject(new Error("Giỏ hàng đang trống"));
      }
      socketRef.current.emit("place_order", {
        customerId,
        customerName: (customerInfo?.name || "").trim(),
        phone: (customerInfo?.phone || "").trim(),
        address: (customerInfo?.address || "").trim(),
        note: (customerInfo?.note || "").trim(),
        items: items.map((i) => ({ foodId: i.id, quantity: i.qty })),
        ...(voucherCode ? { voucherCode: voucherCode.trim() } : {}),
      });
      // Không optimistic-update `orders` ở đây: đơn mới sẽ tự xuất hiện qua
      // "customer_orders_state" server bắn lại ngay sau đó (thường vài chục
      // ms, cùng cơ chế với sendOrder/sendFruitOrder ở bản gốc).
      return Promise.resolve({ ok: true });
    },
    [customerId]
  );

  // items: mảng cart context [{ id (foodId), name, price, qty }]. Dùng ack
  // callback để lấy kết quả TRỰC TIẾP cho đúng lần gọi này, không qua state
  // broadcast như các sự kiện khác — không claim lượt dùng, chỉ tính thử.
  const validateVoucher = useCallback(
    (code, items) => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error("Chưa kết nối được tới server"));
          return;
        }
        if (!code?.trim()) {
          reject(new Error("Vui lòng nhập mã voucher"));
          return;
        }
        socketRef.current.emit(
          "validate_voucher",
          {
            code: code.trim(),
            customerId,
            items: items.map((i) => ({ foodId: i.id, quantity: i.qty })),
          },
          (response) => {
            if (response?.success) resolve(response);
            else reject(new Error(response?.message || "Voucher không hợp lệ"));
          }
        );
      });
    },
    [customerId]
  );
  // Gửi tin nhắn cho quán. Không tự thêm vào `messages` ở đây — chờ server
  // vòng lại qua "chat_message" (cùng room customer:<customerId>), để tin
  // hiện lên đồng nhất trên mọi tab của khách, giống hệt nguyên tắc
  // sendChatMessage ở bản gốc.
  const sendChatMessage = useCallback(
    (text) => {
      if (!socketRef.current || !customerId) return;
      const value = (text || "").trim();
      if (!value) return;
      socketRef.current.emit("send_chat_message", { customerId, text: value });
    },
    [customerId]
  );

  const value = useMemo(
    () => ({
      connected,
      stateReceived,
      orders,
      placeOrder,
      validateVoucher,
      messages,
      chatHistoryReceived,
      sendChatMessage,
    }),
    [connected, stateReceived, orders, placeOrder, messages, chatHistoryReceived, sendChatMessage]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket phải dùng trong SocketProvider");
  return ctx;
}
