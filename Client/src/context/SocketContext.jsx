import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useTable } from "./TableContext";

const SocketContext = createContext(null);

// Đổi qua .env (VITE_SOCKET_URL) khi deploy, mặc định trỏ về server local khi dev.
// Phải khớp với SOCKET_URL trong OrdersPage.jsx / KitchenPage.jsx bên admin & bếp.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

/**
 * Luồng thật với backend (initSocket.js):
 * 1. Khách join phòng riêng của bàn mình: emit "join_table" -> nhận "tables_state"
 *    (một mảng chỉ chứa 1 bàn của mình, gồm cả pendingItems + items + active + messages).
 * 2. Khách gửi món: emit "send_to_kitchen" -> món rơi vào "pendingItems" của bàn,
 *    CHƯA vào bếp, chờ admin xác nhận (bên trang Order của admin).
 * 3. Admin xác nhận (emit "confirm_items") -> món chuyển sang "items" với
 *    status "cooking" -> lúc này bếp mới thấy trong "kitchen_state".
 * 4. Bếp bấm xong (emit "mark_item_ready") -> item.status đổi thành "ready".
 * 5. Chat: khách emit "send_chat_message" -> server lưu DB, bắn lại "chat_message"
 *    (1 tin) cho đúng room bàn này + admin_room. Admin trả lời bằng
 *    "send_admin_chat_message", cũng vòng lại "chat_message" cho bàn này.
 * 6. Khi admin bấm Thanh toán -> "checkout_table" -> ngoài reset bàn, server
 *    còn xoá sạch "messages" trong DB và bắn riêng "chat_cleared" cho room
 *    bàn này, để tab khách (nếu đang mở sẵn, vd tablet gắn cố định tại bàn)
 *    tự dọn sạch khung chat mà không cần tải lại trang.
 *
 * Field `active` — do admin bật/tắt bằng nút toggle ở OrdersPage.jsx (hover
 * trên desktop / slider trên mobile). Đây là "cổng" thay thế cho token cũ:
 * bàn phải active=true thì khách mới được xem thực đơn/gọi món. Vì cùng
 * chảy qua "tables_state" như mọi thay đổi khác của bàn, nó tự động
 * realtime — admin khoá/mở là khách thấy ngay, không cần tải lại trang.
 *
 * `stateReceived` — TableGuard cần phân biệt 3 tình huống mà tableState đều
 * có thể là null:
 *   a) vừa kết nối, CHƯA nhận được "tables_state" lần nào -> nên hiện Loading
 *   b) đã nhận, nhưng server trả mảng rỗng (số bàn trên URL không tồn tại
 *      trong DB) -> nên hiện lỗi "không tìm thấy bàn"
 *   c) đã nhận, có bàn nhưng active=false -> nên hiện "chờ admin mở bàn"
 * Không có cờ này thì (a) và (b) nhìn giống hệt nhau (tableState === null).
 */
export function SocketProvider({ children }) {
  const { table } = useTable();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [stateReceived, setStateReceived] = useState(false);
  const [tableState, setTableState] = useState(null); // { id, name, status, since, items, pendingItems, active, messages }
  const chatListeners = useRef(new Set());
  const chatResetListeners = useRef(new Set());
  // Lịch sử chat của bàn hiện tại + cờ đánh dấu đã nạp lịch sử từ "tables_state"
  // hay chưa. Chỉ nạp 1 LẦN DUY NHẤT ở lần "tables_state" đầu tiên có dữ liệu —
  // các lần "tables_state" sau (do confirm_items, toggle_table_active...) không
  // đụng vào lịch sử chat nữa, vì tin nhắn mới đã tới realtime qua "chat_message"
  // riêng rồi, nạp lại từ tableState mỗi lần sẽ bị lặp tin nhắn. Việc XOÁ lịch
  // sử (sau khi thanh toán) đi qua kênh riêng "chat_cleared", không liên quan
  // tới cờ này.
  const chatHistoryRef = useRef([]);
  const chatHistoryLoadedRef = useRef(false);

  useEffect(() => {
    if (!table?.tableId) return;

    // Reset khi đổi bàn (hiếm khi xảy ra trong 1 phiên, nhưng để chắc chắn
    // không hiển thị nhầm dữ liệu/trạng thái active/chat của bàn cũ trong
    // lúc đang chờ dữ liệu bàn mới).
    setStateReceived(false);
    setTableState(null);
    chatHistoryRef.current = [];
    chatHistoryLoadedRef.current = false;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_table", { tableId: Number(table.tableId) });
    });

    socket.on("disconnect", () => setConnected(false));

    // data luôn là mảng - do server emit theo room table:<id>, chỉ có đúng 1 bàn.
    // Mảng rỗng nghĩa là server không tìm thấy bàn với tableId này.
    socket.on("tables_state", (data) => {
      const nextTable = Array.isArray(data) ? data[0] || null : null;
      setTableState(nextTable);
      setStateReceived(true);

      // Nạp lịch sử chat đúng 1 lần từ dữ liệu bàn server trả về, rồi phát
      // lại cho các listener đã subscribe từ trước (nếu ChatWidget mount
      // và gọi onChatMessage TRƯỚC khi "tables_state" kịp về tới).
      if (!chatHistoryLoadedRef.current && nextTable) {
        chatHistoryLoadedRef.current = true;
        chatHistoryRef.current = nextTable.messages || [];
        chatHistoryRef.current.forEach((m) => {
          chatListeners.current.forEach((cb) => cb(m));
        });
      }
    });

    // Tin nhắn chat mới, realtime — từ khách (tin của chính mình vòng lại
    // để đồng bộ nhiều tab) hoặc từ admin trả lời.
    socket.on("chat_message", (message) => {
      chatHistoryRef.current = [...chatHistoryRef.current, message];
      chatListeners.current.forEach((cb) => cb(message));
    });

    // Admin vừa thanh toán bàn này → lịch sử chat trong DB đã bị xoá sạch.
    // Dọn luôn bản trong RAM + báo cho ChatWidget xoá màn hình hiển thị,
    // để phiên chat cũ không lộ ra cho khách tiếp theo ngồi vào bàn.
    socket.on("chat_cleared", () => {
      chatHistoryRef.current = [];
      chatResetListeners.current.forEach((cb) => cb());
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [table?.tableId]);

  // items: mảng cart context [{ id (foodId), qty }]
  const sendOrder = useCallback(
    (items) => {
      if (!socketRef.current || !table?.tableId) {
        return Promise.reject(new Error("Chưa kết nối được tới server"));
      }
      socketRef.current.emit("send_to_kitchen", {
        tableId: Number(table.tableId),
        items: items.map((i) => ({ foodId: i.id, quantity: i.qty })),
      });
      return Promise.resolve({ ok: true });
    },
    [table?.tableId]
  );

  // ── Chat ───────────────────────────────────────────────────────────────
  // Gửi tin nhắn cho admin của đúng bàn mình. Không tự thêm vào chatHistoryRef
  // ở đây — chờ server vòng lại qua "chat_message" (cùng room table:<id>),
  // để tin nhắn hiện lên đồng nhất trên mọi tab/thiết bị của khách.
  const sendChatMessage = useCallback(
    (text) => {
      if (!socketRef.current || !table?.tableId) return;
      const value = (text || "").trim();
      if (!value) return;
      socketRef.current.emit("send_chat_message", { tableId: Number(table.tableId), text: value });
    },
    [table?.tableId]
  );

  // ChatWidget gọi hàm này để subscribe tin nhắn. Phát lại lịch sử đã có
  // (nếu đã nạp xong) rồi mới đăng ký nhận tin mới, để không bỏ sót tin cũ.
  const onChatMessage = useCallback((cb) => {
    chatHistoryRef.current.forEach(cb);
    chatListeners.current.add(cb);
    return () => chatListeners.current.delete(cb);
  }, []);

  // ChatWidget gọi hàm này để biết khi nào lịch sử chat bị xoá sạch (sau khi
  // admin thanh toán bàn) và tự reset khung chat về rỗng.
  const onChatReset = useCallback((cb) => {
    chatResetListeners.current.add(cb);
    return () => chatResetListeners.current.delete(cb);
  }, []);

  const value = useMemo(
    () => ({
      connected,
      stateReceived,
      tableState,
      // Tiện dùng cho TableGuard: đã xác nhận với server là bàn này TỒN TẠI
      // hay chưa, và nếu tồn tại thì có đang active hay không.
      tableKnown: stateReceived && tableState !== null,
      tableActive: !!tableState?.active,
      sendOrder,
      sendChatMessage,
      onChatMessage,
      onChatReset,
    }),
    [connected, stateReceived, tableState, sendOrder, sendChatMessage, onChatMessage, onChatReset]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket phải dùng trong SocketProvider");
  return ctx;
}