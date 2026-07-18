import React, { useState, useEffect } from "react";
import { Minus, Plus, Info } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import FoodThumbnail from "./FoodThumbnail";
import { formatCurrency } from "../../utils/formatCurrency";

// ⚠️ Đã bỏ ô "ghi chú cho bếp" do khách tự nhập - backend (send_to_kitchen)
// hiện chỉ nhận { foodId, quantity }, không có chỗ lưu ghi chú riêng từng món,
// nên hiển thị ô nhập đó sẽ khiến khách tưởng nhầm là bếp thấy được ghi chú.
// Muốn thêm lại, cần bổ sung field note vào pendingItems/items ở TableModel
// và xử lý trong initSocket.js (send_to_kitchen, confirm_items).
export default function MenuItemDetailModal({ item, onClose, onAdd }) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [item]);

  if (!item) return null;
  const unavailable = !item.isAvailable;

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item.foodName}
      footer={
        <Button
          fullWidth
          disabled={unavailable}
          onClick={() => {
            onAdd(item, qty);
            onClose();
          }}
        >
          {unavailable ? "Món hiện đang hết hàng" : `Thêm vào giỏ · ${formatCurrency(item.originalPrice * qty)}`}
        </Button>
      }
    >
      <FoodThumbnail src={item.imageUrl} alt={item.foodName} className="w-full h-44 rounded-2xl mb-4" />
      <p className="text-steel text-sm leading-relaxed mb-3">{item.description}</p>

      {/* note: ghi chú của NHÀ HÀNG dành cho khách (VD dị ứng / mức độ cay...), lấy từ Food schema */}
      {item.note && (
        <div className="flex items-start gap-2 bg-turmeric-light rounded-xl px-3 py-2.5 mb-4">
          <Info size={14} className="text-turmeric-dark mt-0.5 flex-shrink-0" />
          <p className="text-xs text-ink leading-relaxed">{item.note}</p>
        </div>
      )}

      {item.ingredients?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-display font-medium text-steel mb-1.5">Thành phần chính</p>
          <div className="flex flex-wrap gap-1.5">
            {item.ingredients.map((ing) => (
              <span
                key={ing.ingredientId}
                className="text-xs bg-paper-dim text-ink rounded-full px-2.5 py-1"
              >
                {ing.ingredientName} · {ing.quantity}{ing.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-5">
        <span className="ticket-num text-lg font-semibold text-chili-dark">
          {formatCurrency(item.originalPrice)}
        </span>
        {!unavailable && (
          <div className="flex items-center gap-3 bg-paper-dim rounded-full px-1.5 py-1.5">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-paper text-ink active:bg-ink/10"
              aria-label="Giảm số lượng"
            >
              <Minus size={15} />
            </button>
            <span className="ticket-num w-5 text-center font-medium">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-ink text-paper active:bg-ink-soft"
              aria-label="Tăng số lượng"
            >
              <Plus size={15} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
