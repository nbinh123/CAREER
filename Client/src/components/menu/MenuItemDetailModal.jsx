import React, { useState, useEffect } from "react";
import { Minus, Plus, Info } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import FoodThumbnail from "./FoodThumbnail";
import { formatCurrency } from "../../utils/formatCurrency";

export default function MenuItemDetailModal({
  item,
  onClose,
  onAdd,
}) {
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
          {unavailable
            ? "Món hiện đang hết hàng"
            : `Thêm vào giỏ · ${formatCurrency(
                item.originalPrice * qty
              )}`}
        </Button>
      }
    >
      <FoodThumbnail
        src={item.imageUrl}
        alt={item.foodName}
        className="w-full h-44 rounded-2xl mb-5"
      />

      <p className="text-steel text-sm leading-relaxed mb-5">
        {item.description}
      </p>

      {false && item.note && (
        <div className="flex items-start gap-2 bg-turmeric-light rounded-xl px-3 py-2.5 mb-5">
          <Info
            size={14}
            className="text-turmeric-dark mt-0.5 flex-shrink-0"
          />
          <p className="text-xs text-ink leading-relaxed">
            {item.note}
          </p>
        </div>
      )}

      {false && item.ingredients?.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-display font-medium text-steel mb-2">
            Thành phần chính
          </p>

          <div className="flex flex-wrap gap-2">
            {item.ingredients.map((ing) => (
              <span
                key={ing.ingredientId}
                className="text-xs bg-paper-dim text-ink rounded-full px-3 py-1"
              >
                {ing.ingredientName} · {ing.quantity}
                {ing.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <span className="ticket-num text-xl font-semibold text-chili-dark">
          {formatCurrency(item.originalPrice)}
        </span>

        {!unavailable && (
          <div className="flex items-center gap-3 bg-paper-dim rounded-full px-2 py-1.5">
            <button
              onClick={() =>
                setQty((q) => Math.max(1, q - 1))
              }
              className="w-9 h-9 rounded-full bg-paper flex items-center justify-center hover:bg-gray-100 transition"
              aria-label="Giảm số lượng"
            >
              <Minus size={16} />
            </button>

            <span className="ticket-num w-8 text-center font-semibold text-base">
              {qty}
            </span>

            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center hover:bg-ink-soft transition"
              aria-label="Tăng số lượng"
            >
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}