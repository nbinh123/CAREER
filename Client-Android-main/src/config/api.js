// Base URL của backend (Express). KHÔNG dùng localhost trên mobile — Android
// chặn mặc định HTTP cleartext và cả 2 nền tảng đều không thấy máy dev qua
// localhost. Trỏ thẳng về domain production đã có HTTPS (xem mục 5.5 kế
// hoạch) hoặc IP LAN của máy dev khi test bằng Expo Go trong mạng nội bộ.
//
// Khuyến nghị đọc từ app.config.js (expo-constants) để đổi giữa các môi
// trường (dev/staging/production) mà không phải sửa code:
//
//   import Constants from "expo-constants";
//   export const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl;
//
// Tạm thời khai báo trực tiếp ở đây để bạn điền domain thật vào (xem câu hỏi
// mở ở mục 8 tài liệu kế hoạch — cần domain backend production thực tế).
export const API_BASE_URL = "http://192.168.100.213:5000/";
export const SOCKET_URL = API_BASE_URL;
