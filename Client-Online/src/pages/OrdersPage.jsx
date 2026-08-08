import React from "react";
import { Receipt } from "lucide-react";
import OrderCard from "../components/order/OrderCard";
import Loading from "../components/common/Loading";
import { useSocket } from "../context/SocketContext";

// Khác với HistoryPage bản gốc (chỉ có dữ liệu của LƯỢT DÙNG BỮA hiện tại
// tại 1 bàn, lấy tạm từ tableState vì backend chưa có endpoint riêng theo
// bàn), trang này hiển thị TẤT CẢ đơn thuộc `customerId` của trình duyệt
// này — do server đã lọc sẵn theo phòng `customer:<customerId>` (xem
// SocketContext) nên không cần gọi thêm API riêng, danh sách tự cập nhật
// realtime mỗi khi quán đổi trạng thái đơn.
export default function OrdersPage() {
  const { orders, stateReceived } = useSocket();

  if (!stateReceived) {
    return <Loading label="Đang tải đơn hàng..." />;
  }

  return (
    <div className="px-4 pt-4">
      <p className="text-steel text-xs mb-4">Các đơn bạn đã đặt, cập nhật trạng thái realtime.</p>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-steel">
          <Receipt size={32} className="mb-3 text-steel-light" />
          <p className="text-sm">Bạn chưa đặt đơn nào.</p>
        </div>
      ) : (
        orders.map((order) => <OrderCard key={order.id} order={order} />)
      )}
    </div>
  );
}
