import React from "react";
import { Minus, Plus, PartyPopper } from "lucide-react"; // bỏ X
import Button from "../common/Button";
import { formatCurrency } from "../../utils/formatCurrency";

export default function FruitMixBar({
  selected,
  onRemove,
  quantity,
  onQuantityChange,
  matchedCombo,
  registerSlotRef,
  ready,
  totalPrice,
  submitting,
  onSubmit,
}) {
  return (
    <div className="bg-paper rounded-t-ticket shadow-float border-t border-ink/8 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between mb-2.5">
        <p className="font-display font-semibold text-ink text-sm">
          Combo của bạn · {selected.length}/3
        </p>
        {matchedCombo && (
          <span className="flex items-center gap-1 text-[11px] font-display font-medium text-jade bg-jade-light px-2 py-1 rounded-full">
            <PartyPopper size={12} />
            Đã có sẵn trong thực đơn
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-2 flex-1">
          {[0, 1, 2].map((slot) => {
            const item = selected[slot];
            return (
              <button
                key={slot}
                type="button"
                ref={(node) => registerSlotRef?.(slot, node)}
                onClick={() => item && onRemove(item)} // chỉ gọi onRemove khi có item
                className={`flex-1 h-14 rounded-xl border flex items-center justify-center px-2 text-center transition-colors ${
                  item
                    ? "border-jade/40 bg-jade-light cursor-pointer active:bg-jade/20"
                    : "border-dashed border-ink/15 bg-paper-dim cursor-default"
                }`}
              >
                {item ? (
                  <span className="font-display text-xs font-medium text-ink truncate">
                    {item.fruitName}
                  </span>
                ) : (
                  <span className="text-steel-light text-[11px]">Chọn loại {slot + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hàng số lượng + nút gửi đơn */}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5 bg-paper-dim rounded-full px-1.5 py-1.5">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="w-7 h-7 rounded-full bg-paper flex items-center justify-center hover:bg-gray-100 transition"
            aria-label="Giảm số lượng"
          >
            <Minus size={13} />
          </button>
          <span className="ticket-num w-5 text-center font-semibold text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center hover:bg-ink-soft transition"
            aria-label="Tăng số lượng"
          >
            <Plus size={13} />
          </button>
        </div>

        <Button
          onClick={onSubmit}
          disabled={!ready || submitting}
          size="sm"
          className="flex-1"
        >
          {submitting
            ? "Đang gửi..."
            : `Gửi đơn · ${formatCurrency(totalPrice)}`}
        </Button>
      </div>
    </div>
  );
}