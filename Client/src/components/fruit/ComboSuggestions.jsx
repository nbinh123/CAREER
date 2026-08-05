import React from "react";
import { Sparkles } from "lucide-react";
import FoodThumbnail from "../menu/FoodThumbnail";
import { formatCurrency } from "../../utils/formatCurrency";
import { FRUIT_COMBO_PRICE } from "../../utils/fruit";

// Danh sách combo CÓ SẴN TRONG THỰC ĐƠN (Food document, quản lý ở
// FruitPage.js phía admin — mục Combo trái cây mix) có chứa (các) loại
// trái cây khách vừa chọn — bấm vào 1 gợi ý để tự điền đủ 3 loại của combo
// đó vào lựa chọn hiện tại.
//
// `title` cho phép đổi câu dẫn khi component được dùng lại ở vị trí khác
// trong trang (VD nhắc lại 1 lần nữa ngay trên phần gửi đơn) mà không đổi
// hành vi mặc định ở những nơi khác đang dùng component này.
export default function ComboSuggestions({
  combos,
  onPick,
  title = "Gợi ý combo có sẵn với lựa chọn của bạn",
}) {
  if (!combos || combos.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <p className="flex items-center gap-1.5 text-xs font-display font-medium text-turmeric-dark mb-2.5">
        <Sparkles size={13} />
        {title}
      </p>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {combos.map((combo) => (
          <button
            key={combo.id || combo._id}
            type="button"
            onClick={() => onPick(combo)}
            className="flex-shrink-0 w-40 rounded-2xl border border-turmeric/40 bg-turmeric-light/60 p-3 text-left active:bg-turmeric-light"
          >
            <FoodThumbnail
              src={combo.imageUrl}
              alt={combo.foodName}
              className="w-full h-20 rounded-xl mb-2"
            />
            <p className="font-display font-medium text-ink text-[12.5px] leading-snug line-clamp-2">
              {combo.foodName}
            </p>
            <p className="ticket-num text-chili-dark text-[12px] font-semibold mt-1">
              {formatCurrency(FRUIT_COMBO_PRICE)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}