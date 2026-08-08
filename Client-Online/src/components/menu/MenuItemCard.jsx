import React from "react";
import { Plus, Flame } from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency";
import FoodThumbnail from "./FoodThumbnail";

export default function MenuItemCard({ item, isBestSeller, onOpen, onQuickAdd }) {
  const unavailable = !item.isAvailable;

  return (
    <div className={`flex gap-3 py-4 px-4 dashed-divider first:border-t-0 ${unavailable ? "opacity-60" : ""}`}>
      <button onClick={() => onOpen(item)} className="relative flex-shrink-0 w-24 h-24 rounded-2xl">
        <FoodThumbnail src={item.imageUrl} alt={item.foodName} className="w-24 h-24 rounded-2xl" />
        {isBestSeller && !unavailable && (
          <span className="absolute top-1 left-1 flex items-center gap-0.5 bg-chili text-paper text-[10px] font-display font-semibold px-1.5 py-0.5 rounded-full">
            <Flame size={10} />
            Bán chạy
          </span>
        )}
        {unavailable && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40 rounded-2xl">
            <span className="bg-ink text-paper text-[10px] font-display font-medium px-2 py-1 rounded-full">
              Hết hàng
            </span>
          </span>
        )}
      </button>

      <div className="flex-1 min-w-0" onClick={() => onOpen(item)}>
        <h3 className="font-display font-semibold text-ink text-[15px] leading-snug">{item.foodName}</h3>
        <p className="text-steel text-xs mt-1 leading-relaxed line-clamp-2">{item.description}</p>
        <div className="flex items-center justify-between mt-2.5">
          <span className="ticket-num text-chili-dark font-semibold text-[15px]">
            {formatCurrency(item.originalPrice)}
          </span>
          {unavailable ? (
            <span className="text-[11px] text-steel font-display px-2">Tạm hết</span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd(item);
              }}
              aria-label={`Thêm ${item.foodName}`}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-ink text-paper active:bg-ink-soft"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
