// Y hệt bản web (src/constants/orderStatus.js) — thuần dữ liệu, không đụng gì
// tới DOM nên copy nguyên, chỉ đổi "tone" từ class Tailwind sang key màu để
// OrderCard (RN) tự map sang className NativeWind tương ứng.
export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  DELIVERING: "delivering",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const ORDER_STATUS_META = {
  [ORDER_STATUS.PENDING]: { label: "Chờ xác nhận", tone: "turmeric" },
  [ORDER_STATUS.CONFIRMED]: { label: "Đã xác nhận", tone: "turmeric" },
  [ORDER_STATUS.PREPARING]: { label: "Đang chuẩn bị", tone: "turmeric" },
  [ORDER_STATUS.DELIVERING]: { label: "Đang giao hàng", tone: "jade" },
  [ORDER_STATUS.COMPLETED]: { label: "Hoàn tất", tone: "jade" },
  [ORDER_STATUS.CANCELLED]: { label: "Đã huỷ", tone: "chili" },
};

// tone -> cặp className NativeWind (nền nhạt + chữ đậm) dùng chung cho badge
// trạng thái. Tách riêng để không lặp chuỗi class ở nhiều nơi.
export const STATUS_TONE_CLASS = {
  turmeric: "bg-turmeric-light text-turmeric-dark",
  jade: "bg-jade-light text-jade",
  chili: "bg-chili-light text-chili-dark",
};

export const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.DELIVERING,
];
