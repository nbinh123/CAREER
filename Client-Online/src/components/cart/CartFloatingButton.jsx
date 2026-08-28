import React from "react";
import { ChevronUp } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../utils/formatCurrency";

// `floating` (mặc định true): tự định vị `fixed` sát đáy màn hình — hành vi
// gốc, dùng ở MenuPage, nơi không có thanh cố định nào khác phía dưới nó.
//
// `floating={false}`: bỏ lớp `fixed`/`bottom` của CHÍNH nút này, chỉ trả về
// mỗi cái nút — dùng ở những trang đã có sẵn 1 thanh cố định khác dưới đáy
// (vd FruitPage với FruitMixBar). Trang gọi tự bọc nút này trong 1 container
// `fixed` DÙNG CHUNG với thanh kia rồi xếp chồng bằng flexbox (`flex-col` +
// `gap`), để 2 thanh không đè lên nhau. Cách này không cần đoán trước chiều
// cao (tính bằng px/rem) của thanh còn lại — flexbox tự lo, kể cả khi sau
// này chiều cao thanh kia đổi.
export default function CartFloatingButton({ onOpen, floating = true }) {
  const { totalCount, totalPrice } = useCart();

  if (totalCount === 0) return null;

  const button = (
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
  );

  if (!floating) return button;

  return (
    <div
      className="fixed inset-x-0 z-30 px-4 animate-slide-up"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
    >
      {button}
    </div>
  );
}