# Ăn thỏa thích — RN app (bản chạy độc lập)

Dự án Expo/React Native **chạy độc lập**, đóng gói từ bộ mã Giai đoạn 5
(`Client-Online-RN-GiaiDoan5.zip`) + phần Auth (Đăng nhập/Đăng ký/Tài khoản)
viết thêm để có đủ luồng dùng thử, vì dự án gốc giả định đã có sẵn từ
"Giai đoạn 4".

## 1. Cài đặt

```bash
npm install
```

## 2. Trỏ về backend thật

Sửa `src/config/api.js`:

```js
export const API_BASE_URL = "https://domain-backend-that-cua-ban.example.com";
```

- Không dùng `localhost` — máy thật/máy ảo không thấy `localhost` của máy dev.
- Test qua Expo Go trong mạng nội bộ → dùng IP LAN của máy dev (vd
  `http://192.168.1.x:3000`, và backend phải bật CORS/HTTP cho IP đó).
- Nếu chưa có backend, app vẫn **mở và chạy** được (màn Đăng nhập hiện ra
  bình thường), chỉ các thao tác gọi API (đăng nhập, tải menu...) sẽ báo lỗi
  cho tới khi có backend thật.

## 3. Chạy

```bash
npx expo start
```

Quét mã QR bằng app **Expo Go** (Android/iOS), hoặc bấm `a`/`i` trong
terminal để mở Android/iOS simulator nếu máy bạn có sẵn.

## 4. Backend cần những endpoint nào

Theo đúng các file trong `src/api/` và `src/context/`:

| Method | Endpoint | Dùng ở |
| --- | --- | --- |
| POST | `/api/customers/login` `{phone, password}` | Đăng nhập |
| POST | `/api/customers/register` `{phone, password, fullName}` | Đăng ký |
| GET | `/api/customers/me` | Lấy hồ sơ |
| PATCH | `/api/customers/me` | Cập nhật hồ sơ (Checkout, Tài khoản) |
| POST | `/api/customers/refresh-token` `{refreshToken}` | Tự refresh khi 401 |
| POST | `/api/customers/logout` | Đăng xuất |
| POST | `/api/customers/logout-all` | Đăng xuất mọi thiết bị |
| GET | `/api/customers/me/orders` | Lịch sử đơn |
| GET | `/api/foods` | Thực đơn |
| GET | `/api/fruits`, `/api/fruits/combo` | Trái cây / gợi ý combo |
| GET | `/api/fruit-orders/top-combos?limit=` | Combo bán chạy |

Socket.IO (namespace mặc định), connect kèm `auth: { token: accessToken }`:
- Server verify token lúc handshake, tự join phòng `customer:<accountId>`.
- Lắng nghe: `customer_orders_state`, `chat_history`, `chat_message`.
- Emit: `place_order`, `send_chat_message` (không kèm `customerId` — server
  tự suy từ token).

Xem chi tiết trong `HUONG_DAN_TICH_HOP.md` (giữ nguyên từ bộ gốc).

## 5. Những gì đã thêm so với bộ Giai đoạn 5 gốc

Bộ gốc giả định đã có Auth Stack + AuthContext thật từ "Giai đoạn 4". Vì
chạy độc lập, đã thêm:

- `src/screens/LoginScreen.jsx`, `RegisterScreen.jsx` — màn hình mới.
- `src/screens/AccountScreen.jsx` — bản tối giản (hồ sơ + đăng xuất).
- `src/navigation/AuthStackNavigator.jsx`, `RootNavigator.jsx` — điều hướng
  Auth Stack ⇄ Main Tab Navigator theo `isAuthenticated`.
- `src/context/AuthContext.jsx` — dùng nguyên bản "tham khảo" có sẵn trong
  zip gốc (đã đủ chức năng: login/register/refresh token/logout).
- `App.jsx`, `babel.config.js`, `metro.config.js`, `global.css` — khung dự
  án Expo + NativeWind v4 mới, vì zip gốc chỉ có `src/`.
- Mở tab "Tài khoản" trong `MainTabNavigator.jsx` (bản gốc để comment vì
  thuộc phạm vi Giai đoạn 4).

Toàn bộ phần Menu/Trái cây/Giỏ hàng/Đơn hàng/Chat giữ **nguyên logic** như
bộ Giai đoạn 5 gốc, không chỉnh sửa.

## 6. Đã kiểm tra

- Toàn bộ 54 file `.js`/`.jsx` build qua Babel với đúng config dự án
  (`babel-preset-expo` + `nativewind/babel`) — không lỗi cú pháp.
- Toàn bộ import tương đối (`./`, `../`) đã trỏ đúng file tồn tại.
- Chưa test được trên thiết bị/simulator thật (môi trường tạo dự án này
  không có Android/iOS runtime) — cần bạn tự chạy `npx expo start` và bấm
  thử luồng Đăng ký → Đăng nhập → Menu → Giỏ hàng → Checkout → Đơn hàng.
