import React from "react";
import { ChevronUp } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../utils/formatCurrency";

export default function CartFloatingButton({ onOpen }) {
  const { totalCount, totalPrice } = useCart();

  if (totalCount === 0) return null;

  return (
    <div
      className="fixed inset-x-0 z-30 px-4 animate-slide-up"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
    >
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-between bg-ink text-paper rounded-full pl-2 pr-4 py-2 shadow-float"
      >
        <span className="flex items-center gap-2">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-chili ticket-num font-semibold text-sm">
            {totalCount}
          </span>
          <span className="font-display text-sm font-medium">Xem đơn của bạn</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="ticket-num font-semibold text-sm text-turmeric">{formatCurrency(totalPrice)}</span>
          <ChevronUp size={16} />
        </span>
      </button>
    </div>
  );
}
