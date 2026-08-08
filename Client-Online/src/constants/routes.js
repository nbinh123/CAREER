// Không còn khái niệm "bàn" nên bỏ ENTRY (xác thực QR) và INVALID (bàn không hợp lệ).
// Khách vào thẳng trang thực đơn, không cần qua bước xác thực nào.
//
// FRUITS vẫn là 1 trang riêng (giao diện y hệt bản gốc), khác biệt duy nhất
// là combo ghép xong được THÊM VÀO GIỎ HÀNG CHUNG thay vì gửi thẳng lên
// server — xem components/fruit/FruitPage cho chi tiết.
export const ROUTES = {
  MENU: "/",
  FRUITS: "/fruits",
  ORDERS: "/orders", // theo dõi các đơn đã đặt (realtime qua socket)
};
