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
 * Khác biệt DUY NHẤT và QUAN TRỌNG NHẤT so với bản web:
 *
 * - Bản web: client tự khai customerId.
 * - Bản mobile: KHÔNG gửi customerId để server tin trực tiếp.
 *   Socket được xác thực bằng accessToken:
 *
 *     auth: { token: accessToken }
 *
 *   Server verify token rồi tự xác định customer/account tương ứng.
 *
 * Các event:
 *   customer_orders_state
 *   chat_history
 *   chat_message
 *   place_order
 *   validate_voucher
 *   send_chat_message
 *
 * đều sử dụng connection đã được authenticate.
 */
export function SocketProvider({ children }) {
  const {
    accessToken,
    isAuthenticated,
    user,
  } = useAuth();

  const { showToast } = useGlobal();

  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [stateReceived, setStateReceived] = useState(false);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatHistoryReceived, setChatHistoryReceived] =
    useState(false);

  const prevStatusRef = useRef(new Map());
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
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

      // Mobile authenticate socket bằng access token.
      auth: {
        token: accessToken,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", () => {
      setConnected(false);
    });

    socket.on("customer_orders_state", (data) => {
      const nextOrders = Array.isArray(data)
        ? data
        : [];

      if (hasLoadedOnceRef.current) {
        nextOrders.forEach((order) => {
          const prevStatus =
            prevStatusRef.current.get(order.id);

          if (
            prevStatus &&
            prevStatus !== order.status
          ) {
            const label =
              ORDER_STATUS_META[
                order.status
              ]?.label || order.status;

            showToast(
              `Đơn #${String(order.id).slice(-6)}: ${label}`,
              "info"
            );
          }
        });
      }

      prevStatusRef.current = new Map(
        nextOrders.map((o) => [
          o.id,
          o.status,
        ])
      );

      hasLoadedOnceRef.current = true;

      setOrders(nextOrders);
      setStateReceived(true);
    });

    socket.on("chat_history", (data) => {
      setMessages(
        Array.isArray(data)
          ? data
          : []
      );

      setChatHistoryReceived(true);
    });

    socket.on("chat_message", (message) => {
      setMessages((prev) => [
        ...prev,
        message,
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    isAuthenticated,
    accessToken,
    showToast,
  ]);

  // Reconnect chủ động khi app quay lại foreground.
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (nextState) => {
        if (
          nextState === "active" &&
          socketRef.current &&
          !socketRef.current.connected
        ) {
          socketRef.current.connect();
        }
      }
    );

    return () => sub.remove();
  }, []);

  /**
   * Validate voucher.
   *
   * Web sử dụng:
   *
   *   validateVoucher(code, items)
   *
   * và emit:
   *
   *   validate_voucher
   *
   * Mobile không gửi customerId vì server đã biết customer
   * thông qua access token của socket connection.
   */
  const validateVoucher = useCallback(
    (code, items) => {
      return new Promise(
        (resolve, reject) => {
          const socket =
            socketRef.current;

          if (!socket) {
            reject(
              new Error(
                "Chưa kết nối được tới server"
              )
            );
            return;
          }

          if (!code?.trim()) {
            reject(
              new Error(
                "Vui lòng nhập mã voucher"
              )
            );
            return;
          }

          if (!items?.length) {
            reject(
              new Error(
                "Giỏ hàng đang trống"
              )
            );
            return;
          }

          const emitVoucherValidation = () => {
            socket.emit(
              "validate_voucher",
              {
                code: code
                  .trim()
                  .toUpperCase(),

                items: items.map((item) => ({
                  foodId: item.id,
                  quantity: item.qty,
                })),
              },
              (response) => {
                if (response?.success) {
                  resolve(response);
                } else {
                  reject(
                    new Error(
                      response?.message ||
                        "Voucher không hợp lệ"
                    )
                  );
                }
              }
            );
          };

          if (socket.connected) {
            emitVoucherValidation();
            return;
          }

          // Socket có thể vừa được tạo sau khi login nhanh.
          // Chờ tối đa vài giây giống cơ chế placeOrder.
          const timer = setTimeout(() => {
            socket.off(
              "connect",
              onConnect
            );

            reject(
              new Error(
                "Chưa kết nối được tới server, vui lòng thử lại"
              )
            );
          }, CONNECT_WAIT_TIMEOUT_MS);

          function onConnect() {
            clearTimeout(timer);
            emitVoucherValidation();
          }

          socket.once(
            "connect",
            onConnect
          );
        }
      );
    },
    []
  );

  /**
   * Đặt hàng.
   *
   * voucherCode là tham số thứ 3.
   *
   * Client chỉ gửi code.
   * Server phải tự validate voucher và tính lại finalTotal
   * khi xử lý place_order.
   */
  const placeOrder = useCallback(
    (
      items,
      customerInfo,
      voucherCode
    ) => {
      if (!items?.length) {
        return Promise.reject(
          new Error(
            "Giỏ hàng đang trống"
          )
        );
      }

      return waitForSocketConnected(
        socketRef
      ).then((socket) => {
        socket.emit(
          "place_order",
          {
            customerName: (
              customerInfo?.name || ""
            ).trim(),

            phone: (
              customerInfo?.phone || ""
            ).trim(),

            address: (
              customerInfo?.address || ""
            ).trim(),

            note: (
              customerInfo?.note || ""
            ).trim(),

            items: items.map((item) => ({
              foodId: item.id,
              quantity: item.qty,
            })),

            // Chỉ gửi voucher code.
            // Không gửi finalTotal từ client.
            voucherCode: voucherCode
              ? voucherCode
                  .trim()
                  .toUpperCase()
              : undefined,
          }
        );

        return {
          ok: true,
        };
      });
    },
    []
  );

  const sendChatMessage = useCallback(
    (text) => {
      if (
        !socketRef.current?.connected
      ) {
        return;
      }

      const value = (
        text || ""
      ).trim();

      if (!value) return;

      socketRef.current.emit(
        "send_chat_message",
        {
          text: value,

          customerName:
            user?.name || "",

          phone:
            user?.phone || "",

          address:
            user?.address || "",

          email:
            user?.email || "",
        }
      );
    },
    [user]
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
    [
      connected,
      stateReceived,
      orders,

      placeOrder,
      validateVoucher,

      messages,
      chatHistoryReceived,

      sendChatMessage,
    ]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

const CONNECT_WAIT_TIMEOUT_MS = 4000;

function waitForSocketConnected(
  socketRef
) {
  const socket = socketRef.current;

  if (!socket) {
    return Promise.reject(
      new Error(
        "Chưa kết nối được tới server"
      )
    );
  }

  if (socket.connected) {
    return Promise.resolve(socket);
  }

  return new Promise(
    (resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(
          "connect",
          onConnect
        );

        reject(
          new Error(
            "Chưa kết nối được tới server, vui lòng thử lại"
          )
        );
      }, CONNECT_WAIT_TIMEOUT_MS);

      function onConnect() {
        clearTimeout(timer);
        resolve(socket);
      }

      socket.once(
        "connect",
        onConnect
      );
    }
  );
}

export function useSocket() {
  const ctx =
    useContext(SocketContext);

  if (!ctx) {
    throw new Error(
      "useSocket phải dùng trong SocketProvider"
    );
  }

  return ctx;
}