import React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "../../utils/formatCurrency";

export default function CartItem({ item, onUpdateQty }) {
  return (
    <div className="flex items-start justify-between py-3 dashed-divider first:border-t-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="font-display font-medium text-ink text-sm">{item.name}</p>
        <p className="ticket-num text-chili-dark text-sm font-medium mt-1">{formatCurrency(item.price)}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-paper-dim rounded-full px-1 py-1">
          <button
            onClick={() => onUpdateQty(item.id, item.qty - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-paper text-ink active:bg-ink/10"
            aria-label="Giảm"
          >
            {item.qty === 1 ? <Trash2 size={13} className="text-chili" /> : <Minus size={13} />}
          </button>
          <span className="ticket-num w-4 text-center text-sm">{item.qty}</span>
          <button
            onClick={() => onUpdateQty(item.id, item.qty + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-ink text-paper active:bg-ink-soft"
            aria-label="Tăng"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
