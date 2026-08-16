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
// Đọc từ biến môi trường (EXPO_PUBLIC_*) — Expo (SDK 49+) tự nhúng các biến
// có tiền tố EXPO_PUBLIC_ vào bundle lúc build, không cần cài thêm package
// dotenv. Đổi giá trị trong file .env ở gốc dự án khi chuyển môi trường
// (dev/staging/production), KHÔNG sửa trực tiếp ở đây.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? API_BASE_URL;