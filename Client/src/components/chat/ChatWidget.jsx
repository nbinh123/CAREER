import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { useCart } from "../../context/CartContext";
import ChatBubble from "./ChatBubble";

export default function ChatWidget() {
  const { onChatMessage, onChatReset, sendChatMessage, connected } = useSocket();
  // Nút chat giờ hiện mặc định ở MỌI trang (không chỉ riêng trang chờ cũ),
  // nên phải né thanh "Xem đơn của bạn" (CartFloatingButton) - thanh đó chỉ
  // xuất hiện ở trang gọi món khi giỏ hàng có món, và nằm cùng khoảng cách
  // đáy mặc định (4.5rem) mà nút chat trước đây dùng. Khi giỏ có món, đẩy
  // nút chat lên cao hơn để 2 thứ không đè lên nhau.
  const { totalCount } = useCart();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    const unsubMessage = onChatMessage((msg) => setMessages((prev) => [...prev, msg]));
    // Admin thanh toán bàn → lịch sử chat bị xoá ở server → dọn sạch khung
    // chat hiện tại, tránh khách tiếp theo ngồi vào bàn thấy hội thoại cũ.
    const unsubReset = onChatReset(() => setMessages([]));
    return () => {
      unsubMessage();
      unsubReset();
    };
  }, [onChatMessage, onChatReset]);

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
  const triggerBottom = totalCount > 0 ? "calc(8.5rem + env(safe-area-inset-bottom))" : "calc(4.5rem + env(safe-area-inset-bottom))";

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
            {messages.length === 0 && (
              <p className="text-steel text-xs text-center py-6">
                Cần thêm gia vị, đổi món hay có câu hỏi gì không? Nhắn cho nhân viên nhé.
              </p>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-3 dashed-divider safe-bottom">
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