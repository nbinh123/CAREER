import React from "react";
import { formatCurrency } from "../../utils/formatCurrency";
import { ITEM_STATUS_META } from "../../constants/orderStatus";

export default function OrderItemRow({ item, status, timestamp }) {
  const meta = ITEM_STATUS_META[status];

  return (
    <div className="flex items-center justify-between py-2.5 dashed-divider first:border-t-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="font-display font-medium text-ink text-sm">
          {item.quantity}× {item.foodName}
        </p>
        <p className="ticket-num text-steel text-xs mt-0.5">
          {formatCurrency(item.unitPrice)} / món · {formatCurrency(item.unitPrice * item.quantity)}
        </p>
      </div>
      {meta && (
        <span className={`text-[11px] font-display font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${meta.tone}`}>
          {meta.label}
        </span>
      )}
    </div>
  );
}
