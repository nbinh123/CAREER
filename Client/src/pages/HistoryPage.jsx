import React, { useMemo } from "react";
import { Receipt } from "lucide-react";
import OrderItemRow from "../components/order/OrderItemRow";
import { useSocket } from "../context/SocketContext";
import { formatCurrency } from "../utils/formatCurrency";
import { ITEM_STATUS } from "../constants/orderStatus";

// ⚠️ Backend hiện chưa có endpoint lịch sử đơn AN TOÀN theo từng bàn cho khách
// (API /api/orders phía admin trả về TẤT CẢ bàn, không lọc theo bàn -> không
// nên gọi từ app khách). Trang này tạm dùng chính dữ liệu realtime của bàn
// (tableState) để làm "nhật ký các món đã gửi trong buổi ngồi hiện tại".
// Nếu muốn xem được lịch sử các lần ghé quán TRƯỚC đó, cần thêm 1 endpoint
// dạng GET /api/tables/:tableId/orders (lọc theo tableId) ở backend.
export default function HistoryPage() {
  const { tableState } = useSocket();

  const rows = useMemo(() => {
    const pending = (tableState?.pendingItems || []).map((i) => ({
      item: i,
      status: ITEM_STATUS.PENDING,
      at: i.submittedAt,
    }));
    const confirmed = (tableState?.items || []).map((i) => ({
      item: i,
      status: i.status,
      at: i.confirmedAt,
    }));
    return [...pending, ...confirmed].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [tableState]);

  const total = rows.reduce((sum, r) => sum + r.item.unitPrice * r.item.quantity, 0);

  return (
    <div className="px-4 pt-4">
      <p className="text-steel text-xs mb-4">Các món đã gọi trong lượt dùng bữa hiện tại tại bàn của bạn.</p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-steel">
          <Receipt size={32} className="mb-3 text-steel-light" />
          <p className="text-sm">Chưa có món nào được gọi.</p>
        </div>
      ) : (
        <div className="bg-paper rounded-ticket border border-ink/8 px-4 py-2">
          {rows.map((r) => (
            <OrderItemRow key={String(r.item.foodId) + r.status} item={r.item} status={r.status} />
          ))}
          <div className="flex justify-between pt-3 pb-1">
            <span className="font-display font-semibold text-ink text-sm">Tổng cộng</span>
            <span className="ticket-num font-semibold text-chili-dark">{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
