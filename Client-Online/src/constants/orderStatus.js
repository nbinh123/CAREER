// Khác với bản gọi món tại bàn (chỉ có pending/cooking/ready ở cấp độ TỪNG MÓN),
// đơn online là một ĐƠN HOÀN CHỈNH (nhiều món + tên/SĐT/địa chỉ) đi qua một luồng
// trạng thái tuyến tính từ lúc khách bấm đặt tới lúc giao xong. Backend (Order
// model / initSocket.js phía server) cần phát đúng các giá trị bên dưới qua sự
// kiện "customer_orders_state" mỗi khi trạng thái đơn thay đổi.
export const ORDER_STATUS = {
  PENDING: "pending", // vừa gửi, quán chưa xác nhận
  CONFIRMED: "confirmed", // quán đã xác nhận sẽ làm
  PREPARING: "preparing", // đang chế biến
  DELIVERING: "delivering", // đã giao cho shipper / đang trên đường giao
  COMPLETED: "completed", // khách đã nhận hàng
  CANCELLED: "cancelled", // đơn bị huỷ (khách huỷ hoặc quán từ chối)
};

export const ORDER_STATUS_META = {
  [ORDER_STATUS.PENDING]: { label: "Chờ xác nhận", tone: "bg-turmeric-light text-turmeric-dark" },
  [ORDER_STATUS.CONFIRMED]: { label: "Đã xác nhận", tone: "bg-turmeric-light text-turmeric-dark" },
  [ORDER_STATUS.PREPARING]: { label: "Đang chuẩn bị", tone: "bg-turmeric-light text-turmeric-dark" },
  [ORDER_STATUS.DELIVERING]: { label: "Đang giao hàng", tone: "bg-jade-light text-jade" },
  [ORDER_STATUS.COMPLETED]: { label: "Hoàn tất", tone: "bg-jade-light text-jade" },
  [ORDER_STATUS.CANCELLED]: { label: "Đã huỷ", tone: "bg-chili-light text-chili-dark" },
};

// Các trạng thái được xem là "đơn vẫn đang hoạt động" (hiển thị nổi bật / đếm số
// đơn đang xử lý trên Footer chẳng hạn). Completed/cancelled coi là đã kết thúc.
export const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.DELIVERING,
];
