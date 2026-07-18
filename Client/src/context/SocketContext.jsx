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
 *    (một mảng chỉ chứa 1 bàn của mình, gồm cả pendingItems + items + active).
 * 2. Khách gửi món: emit "send_to_kitchen" -> món rơi vào "pendingItems" của bàn,
 *    CHƯA vào bếp, chờ admin xác nhận (bên trang Order của admin).
 * 3. Admin xác nhận (emit "confirm_items") -> món chuyển sang "items" với
 *    status "cooking" -> lúc này bếp mới thấy trong "kitchen_state".
 * 4. Bếp bấm xong (emit "mark_item_ready") -> item.status đổi thành "ready".
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
  const [tableState, setTableState] = useState(null); // { id, name, status, since, items, pendingItems, active }
  const chatListeners = useRef(new Set());

  useEffect(() => {
    if (!table?.tableId) return;

    // Reset khi đổi bàn (hiếm khi xảy ra trong 1 phiên, nhưng để chắc chắn
    // không hiển thị nhầm dữ liệu/trạng thái active của bàn cũ trong lúc
    // đang chờ dữ liệu bàn mới).
    setStateReceived(false);
    setTableState(null);

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
      setTableState(Array.isArray(data) ? data[0] || null : null);
      setStateReceived(true);
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

  // ── Chat (mock tạm - xem cảnh báo phía trên) ──────────────────────────────
  const sendChatMessage = useCallback((text) => {
    const myMsg = { id: `c_${Date.now()}`, from: "guest", text, at: new Date() };
    chatListeners.current.forEach((cb) => cb(myMsg));
    setTimeout(() => {
      const reply = {
        id: `c_${Date.now() + 1}`,
        from: "admin",
        text: "Nhà hàng đã nhận được yêu cầu của bạn, vui lòng chờ trong ít phút nhé!",
        at: new Date(),
      };
      chatListeners.current.forEach((cb) => cb(reply));
    }, 1400);
  }, []);

  const onChatMessage = useCallback((cb) => {
    chatListeners.current.add(cb);
    return () => chatListeners.current.delete(cb);
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
    }),
    [connected, stateReceived, tableState, sendOrder, sendChatMessage, onChatMessage]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket phải dùng trong SocketProvider");
  return ctx;
}