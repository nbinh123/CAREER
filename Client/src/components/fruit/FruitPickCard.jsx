import React from "react";
import { Check } from "lucide-react";
import FoodThumbnail from "../menu/FoodThumbnail";

// Thẻ chọn 1 loại trái cây lẻ (Fruit document) — bấm để chọn/bỏ chọn.
// Bấm lại vào ô ĐÃ chọn để bỏ nó ra khỏi combo mix — không cần thao tác gì
// khác trên mobile, đây là cách chính để bỏ 1 loại ra khỏi combo (ô đã
// chọn luôn bấm được để bỏ chọn dù đã đủ 3, xem `blocked` bên dưới).
// KHÔNG hiện giá (giá combo cố định 35k, không phụ thuộc loại trái cây
// chọn). `disabled` = đã chọn đủ 3 loại khác rồi (chặn chọn thêm), không
// liên quan gì tới isAvailable.
// Truyền cả `event` vào onToggle để FruitPage.js đọc vị trí thẻ trên màn
// hình, làm điểm xuất phát cho animation "bay" vào ô mix khi chọn.
export default function FruitPickCard({ item, selected, disabled, onToggle }) {
  const unavailable = !item.isAvailable;
  const blocked = unavailable || (disabled && !selected);

  return (
    <button
      type="button"
      onClick={(e) => !blocked && onToggle(item, e)}
      disabled={blocked}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 border transition-colors text-center ${
        selected
          ? "border-jade bg-jade-light shadow-md"
          : "border-ink/8 bg-paper active:bg-paper-dim"
      } ${blocked && !selected ? "opacity-40" : ""}`}
    >
      <div className="relative w-16 h-16">
        <FoodThumbnail src={item.imageUrl} alt={item.fruitName} className="w-16 h-16 rounded-full" />
        {unavailable && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40 rounded-full">
            <span className="bg-ink text-paper text-[9px] font-display font-medium px-1.5 py-0.5 rounded-full">
              Hết
            </span>
          </span>
        )}
      </div>
      <p className="font-display font-medium text-ink text-[13px] leading-snug line-clamp-1">
        {item.fruitName}
      </p>
    </button>
  );
}