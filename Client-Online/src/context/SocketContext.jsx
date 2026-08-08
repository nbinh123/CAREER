import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useCustomer } from "./CustomerContext";
import { useGlobal } from "./GlobalContext";
import { ORDER_STATUS_META } from "../constants/orderStatus";

const SocketContext = createContext(null);

// Đổi qua .env (VITE_SOCKET_URL) khi deploy, mặc định trỏ về server local khi dev.
// Phải khớp với SOCKET_URL cấu hình bên admin/bếp.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

/**
 * Bản gốc (gọi món tại bàn) join phòng theo BÀN (`join_table` / tableId) vì
 * đơn vị "sự thật" là cái bàn — nhiều khách cùng bàn cùng xem chung 1 trạng
 * thái. Bản đặt online không còn bàn, đơn vị "sự thật" đổi thành MỘT KHÁCH
 * (nhận diện ẩn danh qua `customerId` — xem CustomerContext) và khách đó có
 * thể có NHIỀU đơn cùng lúc, nên thay vì 1 object `tableState` ta có 1 mảng
 * `orders`.
 *
 * Luồng dự kiến với backend (áp dụng tương tự initSocket.js của bản gốc,
 * cần người viết backend hiện thực đúng các sự kiện sau):
 *
 * 1. Khách kết nối -> emit "join_customer" { customerId } để vào phòng riêng
 *    `customer:<customerId>`.
 * 2. Server trả ngay "customer_orders_state": mảng TẤT CẢ đơn (mọi trạng
 *    thái, mới nhất trước) thuộc customerId này — tương đương "tables_state"
 *    của bản gốc nhưng phát cho từng khách thay vì từng bàn.
 * 3. Khách đặt đơn mới (giỏ hàng + thông tin giao hàng) -> emit "place_order"
 *    { customerId, customerName, phone, address, note,
 *      items: [{ foodId, quantity }] }.
 *    Server tự tra giá từ DB (KHÔNG tin đơn giá/tổng tiền do client gửi lên,
 *    giống hệt nguyên tắc giá cố định ở "send_fruit_order" bản gốc), tạo
 *    Order mới với status "pending", rồi bắn lại "customer_orders_state" cho
 *    đúng room khách này — khách thấy đơn mới xuất hiện trong /orders ngay
 *    lập tức mà không cần tự thêm optimistic vào state ở client.
 * 4. Phía quán (trang admin, không nằm trong dự án Client này) xác nhận /
 *    chuyển trạng thái đơn (pending -> confirmed -> preparing -> delivering
 *    -> completed, hoặc -> cancelled) -> mỗi lần đổi, server bắn lại
 *    "customer_orders_state" cho room khách đó -> khách thấy trạng thái cập
 *    nhật realtime trên /orders, kèm toast báo (xử lý ở dưới).
 * 5. Chat hỗ trợ (ChatWidget.jsx): ngay sau "join_customer", server còn bắn
 *    thêm "chat_history" (mảng toàn bộ tin nhắn cũ của customerId này, nạp
 *    đúng 1 lần). Khách gửi tin: emit "send_chat_message" { customerId,
 *    text } -> server lưu DB rồi bắn lại "chat_message" (1 tin) cho đúng
 *    room khách này + phòng admin, để tin của chính mình cũng vòng lại (đồng
 *    bộ nếu khách mở nhiều tab) và admin trả lời cũng đi qua cùng kênh này.
 *    Khác bản gốc: không có "chat_cleared" (không có sự kiện "thanh toán
 *    bàn" nào để gắn vào) — lịch sử chat tồn tại lâu dài theo customerId.
 *
 * `stateReceived` giữ đúng vai trò như bản gốc: phân biệt "chưa có dữ liệu vì
 * còn đang tải" với "đã tải xong và khách chưa có đơn nào" (mảng rỗng).
 */
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // items: mảng cart context [{ id (foodId), name, price, qty }]
  // customerInfo: { name, phone, address, note }
  const placeOrder = useCallback(
    (items, customerInfo) => {
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
      });
      // Không optimistic-update `orders` ở đây: đơn mới sẽ tự xuất hiện qua
      // "customer_orders_state" server bắn lại ngay sau đó (thường vài chục
      // ms, cùng cơ chế với sendOrder/sendFruitOrder ở bản gốc).
      return Promise.resolve({ ok: true });
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
