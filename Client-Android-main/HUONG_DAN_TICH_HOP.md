# Giai đoạn 5 — Port màn hình chức năng sang React Native

Bộ file này port **Menu, Combo trái cây, Giỏ hàng, Checkout, Đơn hàng, Chat**
từ dự án web `Client-Online` (Vite + React) sang React Native, theo đúng
mục 5.3 và giai đoạn 5 trong `Ke_hoach_React_Native_Auth.docx`.

## Những gì KHÔNG nằm trong bộ file này

Theo đúng phạm vi giai đoạn 5 (không lấn sang giai đoạn 4 các bạn đã làm xong):

- **Auth Stack** (màn Đăng nhập/Đăng ký) — giả định đã có.
- **AuthContext thật** — `src/context/AuthContext.jsx` trong bộ này chỉ là bản
  **THAM KHẢO/DỰ PHÒNG** để các screen chạy thử được ngay. Đọc kỹ comment ở
  đầu file đó. Nếu bạn đã có AuthContext thật từ giai đoạn 4, **xoá file
  tham khảo này** và chỉnh `useAuth()` thật của bạn trả về đúng các field:
  `customer, accessToken, isAuthenticated, login, register, logout, logoutAll, updateProfile`.
- **Setup Expo/NativeWind/React Navigation ban đầu** — giả định đã xong.
- Tab **"Tài khoản"** (hồ sơ, đổi mật khẩu, đăng xuất) — thuộc giai đoạn 4.

## Cách ghép vào dự án đã có

1. Copy toàn bộ thư mục `src/` trong zip này, **merge** vào thư mục `src/`
   của dự án RN thật (không ghi đè các file bạn đã có từ giai đoạn 4, đặc
   biệt là `src/context/AuthContext.jsx` nếu đã tồn tại).
2. Cài các dependency còn thiếu — xem `package-deps-can-them.json`:
   ```bash
   npx expo install axios socket.io-client lucide-react-native react-native-svg \
     nativewind tailwindcss @react-navigation/native @react-navigation/native-stack \
     @react-navigation/bottom-tabs react-native-safe-area-context react-native-screens \
     expo-secure-store expo-font
   ```
3. Đối chiếu `tailwind.config.js` ở root zip này với file thật của bạn —
   merge phần `theme.extend.colors/fontFamily/borderRadius` nếu thiếu token
   nào (token lấy nguyên từ `tailwind.config.js` bản web, mục 5.1b kế hoạch).
4. Điền domain backend thật vào `src/config/api.js` (đang để placeholder
   `TODO-dien-domain...`) — đây là 1 trong 3 câu hỏi mở ở mục 8 kế hoạch,
   cần hỏi lại nếu chưa có domain production chính thức.
5. Gắn `AppProviders` (xem `src/AppProviders.jsx`) vào `App.jsx` gốc, NGAY
   TRONG `AuthProvider` đã có và BAO NGOÀI `NavigationContainer`:
   ```jsx
   <AuthProvider>
     <AppProviders>
       <NavigationContainer>
         <RootNavigator /> {/* Auth Stack <-> Main Tab Navigator, đã có sẵn */}
       </NavigationContainer>
     </AppProviders>
   </AuthProvider>
   ```
6. Trong Main Tab Navigator thật của bạn, gắn 4 tab thuộc giai đoạn 5:
   - Menu → `screens/MenuScreen.jsx`
   - Trái cây → `screens/FruitScreen.jsx`
   - Giỏ hàng → `navigation/CartStackNavigator.jsx` (bọc `CartScreen` +
     `CheckoutScreen`, KHÔNG gắn thẳng 1 screen đơn)
   - Đơn hàng → `screens/OrdersScreen.jsx`

   Xem `navigation/MainTabNavigator.jsx` — chỉ là bản THAM KHẢO để đối
   chiếu cách gắn + cách lấy badge số lượng, không nhất thiết dùng nguyên.
7. Copy `src/assets/logo.png` (đã kèm sẵn) làm app icon / dùng lại trong
   header nếu bạn tự dựng.

## Việc cần làm ở BACKEND để khớp với bộ file này (nhắc lại, không phải code mới)

Theo mục 3.5 kế hoạch — nếu giai đoạn 2 backend đã xong thì bỏ qua mục này:

- Socket khi client là mobile: verify `auth.token` lúc handshake, tự join
  `customer:<accountId>` (accountId lấy từ token, KHÔNG lấy từ client).
- `place_order` / `send_chat_message` từ mobile: KHÔNG có field
  `customerId` trong payload nữa — server tự suy accountId từ socket đã xác
  thực (khác bản web vẫn còn gửi `customerId` tự khai).

## Danh sách file đã port (đối chiếu 1-1 với bản web)

| Web (Client-Online) | RN (bộ file này) | Ghi chú |
| --- | --- | --- |
| `pages/MenuPage.jsx` | `screens/MenuScreen.jsx` | Modal chi tiết món dùng `<Modal>` RN |
| `pages/FruitPage.jsx` | `screens/FruitScreen.jsx` | Toạ độ bay dùng `measureInWindow` |
| `components/cart/CartDrawer.jsx` | `screens/CartScreen.jsx` + `screens/CheckoutScreen.jsx` | Tách 2 bước thành 2 screen (Giỏ hàng là tab riêng) |
| `pages/OrdersPage.jsx` | `screens/OrdersScreen.jsx` | Không đổi logic |
| `components/chat/ChatWidget.jsx` | `components/chat/ChatWidget.jsx` | Cửa sổ chat dùng `<Modal>` RN |
| `context/SocketContext.jsx` | `context/SocketContext.jsx` | **Đổi cơ chế join phòng** — token thay vì customerId ẩn danh |
| `context/CustomerContext.jsx` | *(bỏ)* | Thay bằng `AuthContext` (tài khoản thật) |
| `context/CartContext.jsx`, `context/GlobalContext.jsx` | copy nguyên | Thuần logic, không đụng DOM |
| mọi file trong `hooks/`, `utils/` | copy gần như nguyên | Thuần logic |
| mọi component còn lại | port 1-1 | Đổi thẻ HTML/Tailwind sang RN + NativeWind |

## Việc CHƯA làm (khuyến nghị làm tiếp sau khi ghép xong, không thuộc giai đoạn 5)

- Test thật trên thiết bị: bấm hết luồng Menu → Giỏ hàng → Checkout → Đơn
  hàng → xem cập nhật realtime, và Chat — theo đúng giai đoạn 6 (kiểm thử
  tích hợp nội bộ) trong kế hoạch.
- Header hiển thị logo/tên quán/trạng thái kết nối toàn app (bản web có
  `layout/header/Header.jsx`) — không nằm trong 6 màn hình được liệt kê ở
  giai đoạn 5, nên chưa port. Nếu muốn có, dễ nhất là dùng
  `screenOptions.header` tuỳ biến ở `MainTabNavigator`, đọc `useSocket().connected`.
