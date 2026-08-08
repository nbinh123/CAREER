import React from "react";
import { formatCurrency } from "../../utils/formatCurrency";

// Bản gốc gắn trạng thái (pending/cooking/ready) cho TỪNG MÓN vì bếp xử lý
// món theo món. Đơn online xử lý theo cả ĐƠN (xem OrderCard.jsx cho badge
// trạng thái), nên dòng món ở đây chỉ còn hiển thị tên/số lượng/giá — không
// còn prop `status` nữa.
export default function OrderItemRow({ item }) {
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
    </div>
  );
}
