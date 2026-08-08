import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { useCart } from "../../context/CartContext";
import ChatBubble from "./ChatBubble";

// Khác bản gốc (dùng cơ chế pub-sub onChatMessage/onChatReset trên
// SocketContext) — ở đây `messages` nằm thẳng trong SocketContext state
// (xem SocketContext.jsx), đơn giản hoá vì không còn lý do kỹ thuật buộc
// phải tách riêng: bản gốc cần pub-sub một phần vì "chat_cleared" (xoá sạch
// khi thanh toán bàn) phải báo cho đúng ChatWidget đang mount, còn ở đây
// không có khái niệm "thanh toán/reset" nào cả — lịch sử chat gắn liền với
// customerId nên chỉ cần 1 mảng state bình thường.
//
// Cũng bỏ `chatEnabled` (admin bật/tắt chat theo bàn) — không có trong yêu
// cầu lần này; nếu cần khoá chat theo khách, thêm field tương tự vào
// "chat_history"/"customer_orders_state" rồi đọc lại ở đây sau.
export default function ChatWidget() {
  const { messages, sendChatMessage, connected, chatHistoryReceived } = useSocket();
  // Nút chat hiện ở MỌI trang, nên phải né thanh "Xem đơn của bạn"
  // (CartFloatingButton) — thanh đó chỉ xuất hiện khi giỏ hàng có món, nằm ở
  // khoảng cách đáy mặc định (4.5rem) mà nút chat cũng dùng. Khi giỏ có
  // món, đẩy nút chat lên cao hơn để 2 thứ không đè lên nhau.
  const { totalCount } = useCart();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;
    sendChatMessage(value);
    setText("");
  };

  const unreadFromAdmin = !open && messages.some((m) => m.from === "admin");
  const triggerBottom =
    totalCount > 0 ? "calc(8.5rem + env(safe-area-inset-bottom))" : "calc(4.5rem + env(safe-area-inset-bottom))";

  return (
    <>
      {/* Nút mở chat */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat với nhà hàng"
          className="fixed right-4 z-40 flex items-center justify-center rounded-full bg-chili text-paper shadow-ticket transition-[bottom] duration-200"
          style={{ width: 52, height: 52, bottom: triggerBottom }}
        >
          <MessageCircle size={22} />
          {unreadFromAdmin && (
            <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-turmeric border-2 border-paper" />
          )}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:h-[560px] z-50 bg-paper flex flex-col sm:rounded-ticket sm:shadow-ticket overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3.5 bg-ink text-paper safe-top">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-jade" : "bg-steel-light"}`} />
              <div>
                <p className="font-display font-medium text-sm">Nhân viên hỗ trợ</p>
                <p className="text-[11px] text-steel-light">{connected ? "Đang trực tuyến" : "Đang kết nối..."}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Đóng chat" className="p-1.5">
              <X size={20} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {chatHistoryReceived && messages.length === 0 && (
              <p className="text-steel text-xs text-center py-6">
                Có câu hỏi về món ăn, đơn hàng hay giao nhận? Nhắn cho quán nhé.
              </p>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dashed-divider">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Nhập tin nhắn..."
              className="flex-1 rounded-full bg-paper-dim px-4 py-2.5 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 focus:ring-turmeric"
            />
            <button
              onClick={handleSend}
              aria-label="Gửi"
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-chili text-paper active:bg-chili-dark"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
