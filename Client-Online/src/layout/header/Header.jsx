import React from "react";
import { UtensilsCrossed } from "lucide-react";
import { useGlobal } from "../../context/GlobalContext";
import { useSocket } from "../../hooks/useSocket";

// Không còn "Bàn X" ở góc phải như bản gốc (không có bàn để hiển thị). Thay
// vào đó là một chấm nhỏ báo trạng thái kết nối socket — hữu ích để khách
// biết vì sao đơn chưa "chạy" nếu mạng chập chờn, không bắt buộc phải có.
export default function Header() {
  const { restaurant } = useGlobal();
  const { connected } = useSocket();

  return (
    <header className="fixed top-0 inset-x-0 z-30 h-16 bg-ink text-paper flex items-center justify-between px-4 safe-top">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-chili flex items-center justify-center flex-shrink-0">
          <UtensilsCrossed size={17} />
        </div>
        <div className="leading-tight">
          <p className="font-display font-semibold text-sm">{restaurant.name}</p>
          <p className="text-[11px] text-steel-light">Đặt món online</p>
        </div>
      </div>

      <span className="flex items-center gap-1.5 text-[11px] text-steel-light flex-shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-jade animate-pulse-dot" : "bg-steel"
          }`}
        />
        {connected ? "Đã kết nối" : "Đang kết nối..."}
      </span>
    </header>
  );
}
