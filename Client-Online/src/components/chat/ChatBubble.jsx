import React from "react";
import { formatTime } from "../../utils/formatTime";

// Bản gốc dùng message.from === "guest" (khách ngồi tại bàn). Đổi tên thành
// "customer" cho khớp với mô hình mới (không còn khái niệm "khách tại bàn"),
// nhưng vai trò hiển thị giữ nguyên y hệt: tin của mình căn phải, nền tối;
// tin của quán căn trái, nền sáng.
export default function ChatBubble({ message }) {
  const isCustomer = message.from === "customer";
  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isCustomer ? "bg-ink text-paper rounded-br-md" : "bg-paper-dim text-ink rounded-bl-md"
        }`}
      >
        <p>{message.text}</p>
        <p className={`text-[10px] mt-1 ${isCustomer ? "text-steel-light" : "text-steel"}`}>
          {formatTime(message.at)}
        </p>
      </div>
    </div>
  );
}
