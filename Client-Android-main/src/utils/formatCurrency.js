// Y hệt bản web — toLocaleString("vi-VN") dùng ICU có sẵn trong Hermes từ
// Expo SDK 47+ nên chạy thẳng trên RN, không cần polyfill. Nếu bạn dùng bản
// Expo/Hermes cũ hơn và thấy số hiển thị sai định dạng, cài thêm
// @formatjs/intl-numberformat và polyfill trước khi app khởi động.
export function formatCurrency(amount) {
  return amount.toLocaleString("vi-VN") + "đ";
}
