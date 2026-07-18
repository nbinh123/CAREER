// Khớp đúng với dữ liệu thật ở backend (initSocket.js / TableModel):
// - "pending": món đang nằm trong pendingItems của bàn, CHƯA được admin xác nhận
// - "cooking": admin đã xác nhận, món nằm trong items[] với status "cooking"
// - "ready":   bếp đã bấm xong, items[].status = "ready"
// (Không có bước "confirmed" hay "served" riêng ở tầng dữ liệu hiện tại.)
export const ITEM_STATUS = {
  PENDING: "pending",
  COOKING: "cooking",
  READY: "ready",
};

export const ITEM_STATUS_META = {
  [ITEM_STATUS.PENDING]: { label: "Chờ xác nhận", tone: "bg-turmeric-light text-turmeric-dark" },
  [ITEM_STATUS.COOKING]: { label: "Đang chế biến", tone: "bg-turmeric-light text-turmeric-dark" },
  [ITEM_STATUS.READY]: { label: "Sẵn sàng phục vụ", tone: "bg-jade-light text-jade" },
};
