import React from "react";
import { Check } from "lucide-react";
import FoodThumbnail from "../menu/FoodThumbnail";

export default function FruitPickCard({ item, selected, disabled, onToggle }) {
  const unavailable = !item.isAvailable;
  const blocked = unavailable || (disabled && !selected);

  return (
    <button
      type="button"
      onClick={(e) => !blocked && onToggle(item, e)}
      disabled={blocked}
      aria-pressed={selected}
      className={`relative aspect-square rounded-2xl overflow-hidden border bg-paper transition-all ${
        selected ? "border-jade ring-2 ring-jade shadow-md" : "border-ink/8"
      } ${blocked && !selected ? "opacity-40" : ""}`}
    >
      {/* Khung inset tạo margin quanh ảnh — ảnh không còn sát viền thẻ */}
      <div className="absolute inset-1 rounded-xl overflow-hidden">
        <FoodThumbnail
          src={item.imageUrl}
          alt={item.fruitName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />

        {unavailable && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/50">
            <span className="bg-ink text-paper text-[9px] font-display font-medium px-1.5 py-0.5 rounded-full">
              Hết
            </span>
          </span>
        )}

        {selected && (
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-jade text-paper">
            <Check size={12} strokeWidth={3} />
          </span>
        )}

        <p className="absolute bottom-0 inset-x-0 px-2 py-1.5 font-display font-medium text-paper text-[13px] leading-snug line-clamp-1 text-center">
          {item.fruitName}
        </p>
      </div>
    </button>
  );
}