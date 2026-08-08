import React from "react";
import { MapPin, Phone, StickyNote } from "lucide-react";
import OrderItemRow from "./OrderItemRow";
import { formatCurrency } from "../../utils/formatCurrency";
import { timeAgo, formatTime } from "../../utils/formatTime";
import { ORDER_STATUS_META } from "../../constants/orderStatus";

// Thẻ hiển thị MỘT đơn hàng đầy đủ — không có ở bản gốc (bản gốc chỉ có 1
// bàn nên không cần "thẻ theo đơn", chỉ có 1 danh sách món phẳng). Ở đây mỗi
// khách có thể có nhiều đơn cùng lúc nên cần tách thành từng thẻ riêng, mỗi
// thẻ mang đúng 1 trạng thái (ORDER_STATUS), khác với trạng thái theo món
// (ITEM_STATUS) của bản dine-in.
export default function OrderCard({ order }) {
  const meta = ORDER_STATUS_META[order.status] || { label: order.status, tone: "bg-paper-dim text-steel" };
  const shortCode = String(order.id).slice(-6).toUpperCase();

  return (
    <div className="bg-paper rounded-ticket border border-ink/8 px-4 py-2 mb-4">
      <div className="flex items-center justify-between pt-2 pb-1">
        <div>
          <p className="font-display font-semibold text-ink text-sm">Đơn #{shortCode}</p>
          <p className="text-steel text-[11px] mt-0.5" title={formatTime(order.createdAt)}>
            {timeAgo(order.createdAt)}
          </p>
        </div>
        <span className={`text-[11px] font-display font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${meta.tone}`}>
          {meta.label}
        </span>
      </div>

      <div className="pt-1">
        {order.items.map((item, idx) => (
          <OrderItemRow key={`${item.foodId}-${idx}`} item={item} />
        ))}
      </div>

      <div className="flex justify-between pt-3 pb-2 dashed-divider">
        <span className="font-display font-semibold text-ink text-sm">Tổng cộng</span>
        <span className="ticket-num font-semibold text-chili-dark">{formatCurrency(order.totalPrice)}</span>
      </div>

      <div className="flex flex-col gap-1.5 pb-3 pt-1 text-steel text-xs">
        {order.address && (
          <p className="flex items-start gap-1.5">
            <MapPin size={13} className="flex-shrink-0 mt-0.5" />
            <span>{order.address}</span>
          </p>
        )}
        {order.phone && (
          <p className="flex items-center gap-1.5">
            <Phone size={13} className="flex-shrink-0" />
            <span>{order.phone}</span>
          </p>
        )}
        {order.note && (
          <p className="flex items-start gap-1.5">
            <StickyNote size={13} className="flex-shrink-0 mt-0.5" />
            <span>{order.note}</span>
          </p>
        )}
      </div>
    </div>
  );
}
