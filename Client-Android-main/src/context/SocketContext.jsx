import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { AppState } from "react-native";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useGlobal } from "./GlobalContext";
import { ORDER_STATUS_META } from "../constants/orderStatus";
import { SOCKET_URL } from "../config/api";

const SocketContext = createContext(null);

/**
 * Khác biệt DUY NHẤT và QUAN TRỌNG NHẤT so với bản web (SocketContext.jsx
 * gốc) — đúng theo mục 3.5 kế hoạch:
 *
 *   - Bản web: client tự khai `customerId` (ẩn danh) qua emit "join_customer",
 *     server tin thẳng giá trị đó.
 *   - Bản mobile: KHÔNG emit "join_customer" với id tự khai nữa. Thay vào đó
 *     gửi access token ngay lúc khởi tạo kết nối (`auth: { token }`), server
 *     verify bằng customerAuthMiddleware rồi tự join socket vào phòng
 *     `customer:<accountId>` — accountId lấy từ token đã verify, KHÔNG lấy
 *     từ dữ liệu client gửi lên. Nhờ vậy không còn lỗ hổng "đoán id người
 *     khác" như cơ chế ẩn danh của web.
 *
 * Các sự kiện dữ liệu sau khi đã join phòng (customer_orders_state,
 * chat_history, chat_message, place_order, send_chat_message) giữ nguyên
 * tên/hình dạng như bản web — chỉ khác là payload gửi lên KHÔNG cần kèm
 * customerId/accountId nữa vì server đã biết danh tính qua token của kết
 * nối, không tin bất kỳ id nào client tự khai.
 *
 * Thêm so với bản web: lắng nghe AppState để chủ động reconnect khi app từ
 * nền quay lại foreground (mục 5.4) — socket.io-client tự retry khi mất
 * mạng, nhưng khi hệ điều hành đình chỉ JS thread lúc app bị đưa xuống nền
 * lâu, cần ép reconnect thủ công cho chắc thay vì chờ timeout tự nhiên.
 */
export function SocketProvider({ children }) {
  const { accessToken, isAuthenticated, user } = useAuth();
  const { showToast } = useGlobal();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [stateReceived, setStateReceived] = useState(false);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatHistoryReceived, setChatHistoryReceived] = useState(false);

  const prevStatusRef = useRef(new Map());
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Chưa đăng nhập -> không có gì để join, đảm bảo state sạch (vd sau
      // logout) để không hiện lại đơn/tin nhắn của phiên đăng nhập trước.
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setStateReceived(false);
      setOrders([]);
      setMessages([]);
      setChatHistoryReceived(false);
      hasLoadedOnceRef.current = false;
      return;
    }

    setChatHistoryReceived(false);
    setMessages([]);
    setStateReceived(false);
    hasLoadedOnceRef.current = false;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      auth: { token: accessToken },
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Nếu access token hết hạn giữa chừng, server nên từ chối handshake và
    // bắn lỗi qua đây — bắt lỗi để tránh app treo ở trạng thái "đang kết
    // nối" vô thời hạn. AuthContext (interceptor axios) đã có cơ chế tự
    // refresh cho HTTP request; socket không tự refresh giữa chừng được nên
    // đơn giản nhất là ngắt kết nối, đợi AuthContext refresh ở lần gọi API
    // tiếp theo rồi effect này chạy lại vì accessToken đổi.
    socket.on("connect_error", () => setConnected(false));

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

    socket.on("chat_history", (data) => {
      setMessages(Array.isArray(data) ? data : []);
      setChatHistoryReceived(true);
    });

    socket.on("chat_message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken, showToast]);

  // Reconnect chủ động khi app quay lại foreground (mục 5.4).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    });
    return () => sub.remove();
  }, []);

  // items: mảng cart context [{ id (foodId), name, price, qty }]
  // customerInfo: { name, phone, address, note }
  //
  // BUGFIX (đăng nhập nhanh xong bấm Đặt hàng bị "Chưa kết nối được tới
  // server"): bản cũ kiểm tra `socketRef.current?.connected` NGAY LẬP TỨC —
  // đúng lúc vừa đăng nhập nhanh xong, effect ở trên mới vừa tạo `socket`
  // (io(...)) nhưng handshake còn đang chạy (vài trăm ms tới vài giây tuỳ
  // mạng di động), nên `connected` vẫn là false dù kết nối chắc chắn sẽ
  // thành công ngay sau đó. Khi đăng nhập thủ công thì khách còn mất thời
  // gian gõ SĐT/mật khẩu nên tới lúc bấm Đặt hàng socket luôn đã kết nối
  // xong từ lâu — đó là lý do lỗi này chỉ lộ ra rõ ở nhánh đăng nhập nhanh.
  // Sửa: nếu socket đã tồn tại nhưng chưa "connected", đợi thêm tối đa vài
  // giây cho sự kiện "connect" thay vì từ chối ngay.
  const placeOrder = useCallback((items, customerInfo) => {
    if (!items?.length) {
      return Promise.reject(new Error("Giỏ hàng đang trống"));
    }
    return waitForSocketConnected(socketRef).then((socket) => {
      socket.emit("place_order", {
        customerName: (customerInfo?.name || "").trim(),
        phone: (customerInfo?.phone || "").trim(),
        address: (customerInfo?.address || "").trim(),
        note: (customerInfo?.note || "").trim(),
        items: items.map((i) => ({ foodId: i.id, quantity: i.qty })),
      });
      return { ok: true };
    });
  }, []);

  const sendChatMessage = useCallback((text) => {
    if (!socketRef.current?.connected) return;
    const value = (text || "").trim();
    if (!value) return;
    socketRef.current.emit("send_chat_message", {
      text: value,
      // Đặt tên field khớp với "customerName"/"phone" đã dùng ở placeOrder
      // để đồng bộ quy ước với payload phía admin dashboard.
      customerName: user?.name || "",
      phone: user?.phone || "",
      // Thêm nếu hồ sơ khách có sẵn — bỏ dòng nào không tồn tại
      address: user?.address || "",
      email: user?.email || "",
    });
  }, [user]);

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

const CONNECT_WAIT_TIMEOUT_MS = 4000;

function waitForSocketConnected(socketRef) {
  const socket = socketRef.current;
  if (!socket) {
    return Promise.reject(new Error("Chưa kết nối được tới server"));
  }
  if (socket.connected) return Promise.resolve(socket);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      reject(new Error("Chưa kết nối được tới server, vui lòng thử lại"));
    }, CONNECT_WAIT_TIMEOUT_MS);

    function onConnect() {
      clearTimeout(timer);
      resolve(socket);
    }
    socket.once("connect", onConnect);
  });
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket phải dùng trong SocketProvider");
  return ctx;
}