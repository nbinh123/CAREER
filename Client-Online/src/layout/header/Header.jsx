import React from "react";
import { useGlobal } from "../../context/GlobalContext";
import { useSocket } from "../../hooks/useSocket";
import logoUrl from "../../assets/logo.png"; // đổi path/tên file cho đúng logo của bạn

export default function Header() {
  const { restaurant } = useGlobal();
  const { connected } = useSocket();

  return (
    <header className="fixed top-0 inset-x-0 z-30 h-20 bg-ink text-paper flex items-center justify-between px-4 safe-top">
      <div className="flex items-center gap-2.5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img
            src={logoUrl}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
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