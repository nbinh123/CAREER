# Chien Thang Admin — React Native (Expo)

Bản chuyển đổi sang React Native của dự án web `Admin` (CRA + Tailwind). Xem `progress.md` (ở thư mục gốc bàn giao, cùng cấp với `Admin/`) để biết tiến độ chi tiết theo từng Giai đoạn.

## Trạng thái: nền tảng hoàn chỉnh, chạy được thật

- ✅ Project Expo + NativeWind v4 dựng sẵn
- ✅ Toàn bộ lớp dữ liệu (config/utils/service/zustand) — chuyển từ `Admin/src`, giữ nguyên logic nghiệp vụ
- ✅ Điều hướng: Auth stack (Login/Register) ↔ Main (Drawer 13 mục), 3 tầng bảo vệ route (đăng nhập → đang làm việc → quyền admin)
- ✅ LoginPage (PIN 6 số) + RegisterPage — chuyển đầy đủ
- ✅ HomePage — chuyển đầy đủ, có biểu đồ doanh thu 7 ngày (SVG tự vẽ)
- ✅ CashFlow — chuyển đầy đủ (đã viết ở phiên trước nhưng bị sót bước gắn
  vào AppDrawer.js; đã gắn lại ở phiên chuyển Customers)
- ✅ Customers — chuyển đầy đủ (khoá/mở khoá, reset mật khẩu, xem lịch sử
  đơn hàng); bảng 6 cột gốc đổi thành card dọc vì màn hình di động không
  đủ chỗ hiển thị ngang, xem chi tiết ở đầu file `src/pages/Customers.js`
- ⏳ 10 trang nghiệp vụ còn lại — màn hình giữ chỗ, chờ chuyển tiếp

## Chạy thử

```bash
npm install
npx expo install --fix   # QUAN TRỌNG: tự đồng bộ version native module theo SDK Expo trên máy bạn
cp .env.example .env     # rồi sửa EXPO_PUBLIC_API_URL trỏ tới backend thật
npx expo start
```

Quét QR bằng app Expo Go (Android/iOS), hoặc bấm `a`/`i` để mở emulator/simulator nếu đã cài.

**Backend:** app này chỉ là client — cần chạy song song backend Node/Express + MongoDB của dự án gốc (thư mục `Admin` có `src/express`, `src/server` — không nằm trong phạm vi chuyển đổi này, dự án gốc chạy `npm run dev`/`npm run devv` để bật cả API lẫn socket).

## Vì sao chọn các thư viện này (Giai đoạn 0)

| Nhu cầu web gốc | Lựa chọn RN | Vì sao |
|---|---|---|
| Tailwind className | NativeWind v4 | Tái dùng gần như nguyên vẹn className đã viết, ít phải viết lại StyleSheet tay |
| react-router-dom | React Navigation (Native Stack + Drawer) | Chuẩn de-facto cho RN, Drawer khớp tự nhiên với sidebar gốc |
| lucide-react | lucide-react-native | Cùng bộ icon, tên gần như 1-1 (một vài icon bị đổi tên giữa các version — xem `progress.md` mục 0.5) |
| recharts | *(chưa chốt — xem dưới)* | recharts không chạy trên RN |
| localStorage (zustand persist) | @react-native-async-storage/async-storage | Chuẩn cho persist trên RN |
| Blob/`<a download>` | expo-file-system + expo-sharing | RN không có DOM |
| `<input type="file">` | expo-document-picker / expo-image-picker | Tương đương picker hệ điều hành |
| backdrop-filter blur | expo-blur (BlurView) | Blur thật trên native |
| Google Fonts `@import` | @expo-google-fonts/nunito + expo-font | Load 1 lần lúc khởi động, giữ Splash Screen |
| `navigator.clipboard.writeText` | expo-clipboard | Chuẩn cho copy-to-clipboard trên Expo; dùng lần đầu ở CustomerManager (nút copy mật khẩu tạm) |

**Chart library chưa chốt** — AnalystPage + 10 chart component (EMA/MA/PID/heatmap/pie) cần khối lượng vẽ phức tạp hơn nhiều so với 1 area chart đơn giản. Đã thử nghiệm 1 bản nhẹ tự vẽ bằng `react-native-svg` (`src/components/MiniAreaChart.js`, dùng cho HomePage) — đủ cho nhu cầu đơn giản, nhưng khi vào Chart01-10 nên đánh giá lại `victory-native` hoặc `react-native-gifted-charts` dựa trên khối lượng thực tế của Chart07 (401 dòng, phức tạp nhất).

## Cấu trúc thư mục

```
src/
  config/       — API_URL (đọc từ EXPO_PUBLIC_API_URL / app.json extra)
  utils/        — hàm thuần (fmtVND, dateUtils, mathUtils...) + callAPI.js (axios + interceptor)
  service/      — lớp gọi API theo domain (Auth/Food/Fruit/Ingredient/Analyst)
  zustand/      — state management (useAuthZustand có AsyncStorage persist)
  navigation/   — RootNavigator, AppDrawer, AppHeader, CustomDrawerContent, ProtectedScreen, navConfig
  components/   — component dùng chung (AuthBackground, PrimaryButton, StatCard, MiniAreaChart)
  pages/        — màn hình (LoginPage, RegisterPage, HomePage, CashFlow, Customers đã xong; còn lại là PlaceholderPage)
  theme/        — tokens.js (bảng màu hex cho chỗ không dùng được className) + fonts.js
```

## Cách thêm 1 trang nghiệp vụ thật (thay placeholder)

1. Đối chiếu file gốc tương ứng trong `Admin/src/pages/<TenTrang>.js`.
2. Viết `src/pages/<TenTrang>.js` mới — copy nguyên logic (state, effect, gọi service/store), chỉ đổi lớp hiển thị JSX/CSS → View/Text + className NativeWind.
3. Mở `src/navigation/AppDrawer.js`, thêm dòng vào `SCREEN_COMPONENTS`:
   ```js
   import IngredientsPage from "../pages/IngredientsPage";
   const SCREEN_COMPONENTS = {
     Home: HomePage,
     Ingredients: IngredientsPage, // thêm dòng này
   };
   ```
   Không cần sửa gì khác — quyền truy cập, header, breadcrumb đã tự động áp dụng theo `navConfig.js`.

## Những điểm cần lưu ý khi tiếp tục (đã phát hiện trong quá trình chuyển)

- **`AlertCircle` → `CircleAlert`, và có thể còn icon khác đổi tên** giữa `lucide-react` (web) và version `lucide-react-native` đang dùng. Luôn kiểm tra `node_modules/lucide-react-native/dist/esm/icons/` trước khi import icon mới, đừng suy đoán 1-1 từ tên bên web.
- **react-native-reanimated v4** yêu cầu New Architecture (đã bật mặc định) và babel plugin `react-native-worklets/plugin` (không phải `react-native-reanimated/plugin` như v3) — đã cấu hình đúng trong `babel.config.js`, nhưng nếu nâng cấp Reanimated sau này, kiểm tra lại điểm này.
- **`FoodService`/`FruitService` upload ảnh**: bản gốc có bug đọc nhầm key `localStorage.getItem("token")` (không khớp key thật `"auth-storage"` mà zustand persist dùng) — bản RN đã sửa, đọc thẳng từ store. Nên kiểm tra lại backend có thực sự yêu cầu auth cho route upload hay không.
- **BottomNav.js** (gốc) là code chết, không chuyển. **useModal.js, AppContext.js, GlobalContext.js** cũng là code chết (không được import ở đâu, có vẻ sót lại từ template khác) — không chuyển.
- Sau `npm install`, luôn chạy `npx expo install --fix` — các version trong `package.json` đối chiếu gần đúng với Expo SDK 57 tại thời điểm viết, nhưng Expo cập nhật rất nhanh nên tool này sẽ tự đồng bộ chính xác hơn bất kỳ version nào tôi ghi cứng.
