# Chien Thang Admin — React Native (Expo)

Bản chuyển đổi sang React Native của dự án web `Admin` (CRA + Tailwind). Xem `progress.md` (ở thư mục gốc bàn giao, cùng cấp với `Admin/`) để biết tiến độ chi tiết theo từng Giai đoạn.

## Trạng thái: 9/13 trang nghiệp vụ đã xong, nền tảng chạy được thật

**Cập nhật phiên này: rà soát toàn bộ code, sửa 7 lỗi (chi tiết ở mục "Lỗi
đã sửa" bên dưới) — quan trọng nhất là 5 trang đã viết đầy đủ từ trước
(Menu/Fruit/Online/Storage/Voucher, ~4400 dòng) nhưng chưa từng được gắn
vào Drawer nên coi như chưa tồn tại với người dùng. Đã gắn lại toàn bộ.**

- ✅ Project Expo + NativeWind v4 dựng sẵn
- ✅ Toàn bộ lớp dữ liệu (config/utils/service/zustand) — chuyển từ `Admin/src`, giữ nguyên logic nghiệp vụ
- ✅ Điều hướng: Auth stack (Login/Register) ↔ Main (Drawer 13 mục), 3 tầng bảo vệ route (đăng nhập → đang làm việc → quyền admin)
- ✅ LoginPage (PIN 6 số) + RegisterPage — chuyển đầy đủ
- ✅ HomePage — chuyển đầy đủ, có biểu đồ doanh thu 7 ngày (SVG tự vẽ)
- ✅ CashFlow — chuyển đầy đủ, đã gắn vào Drawer
- ✅ Customers — chuyển đầy đủ (khoá/mở khoá, reset mật khẩu, xem lịch sử
  đơn hàng); bảng 6 cột gốc đổi thành card dọc vì màn hình di động không
  đủ chỗ hiển thị ngang, xem chi tiết ở đầu file `src/pages/Customers.js`
- ✅ Ingredients — chuyển đầy đủ (CRUD "local-first" qua pendingChanges,
  chỉ gọi API khi bấm "Lưu tất cả thay đổi"; xuất/nhập JSON qua
  expo-document-picker + expo-file-system/expo-sharing); bảng 9 cột gốc
  đổi thành card dọc, xem chi tiết ở đầu file `src/pages/IngredientsPage.js`
- ✅ Menu — chuyển đầy đủ (CRUD "local-first" qua useFoodZustand, ảnh món ăn
  qua ImageUploadField, chọn nguyên liệu công thức qua IngredientPicker);
  **vừa gắn lại vào AppDrawer.js phiên này, trước đó là dead code**
- ✅ Fruit — chuyển đầy đủ (2 khối: Trái cây đơn lẻ + Combo trái cây mix);
  **vừa gắn lại vào AppDrawer.js phiên này, trước đó là dead code**
- ✅ Online (đơn hàng online) — chuyển đầy đủ (kết nối socket, 4 cột trạng
  thái pending→confirmed→preparing→delivering); **vừa gắn lại vào
  AppDrawer.js phiên này, trước đó là dead code**
- ✅ Storage (nhập/xuất kho) — chuyển đầy đủ, có upload ảnh hoá đơn; **vừa
  gắn lại vào AppDrawer.js phiên này, trước đó là dead code**
- ✅ Voucher — chuyển đầy đủ (stats theo khoảng thời gian, tìm kiếm debounce,
  lọc theo status); **vừa gắn lại vào AppDrawer.js phiên này, trước đó là
  dead code**
- ⏳ 4 trang nghiệp vụ còn lại — thật sự CHƯA có code, vẫn dùng
  PlaceholderPage: **Orders** (`/orders`), **Analyst** (`/analyst`, dù
  `AnalystService.js` đã có sẵn ở lớp service — chỉ thiếu UI + 10 chart),
  **StaffManager** (`/staff-manager`), **Kitchen** (`/kitchen`)

## Lỗi đã sửa trong phiên này

1. **[Nghiêm trọng] 5 trang chưa gắn vào Drawer** — `AppDrawer.js` chỉ import
   4/9 trang đã viết xong (`SCREEN_COMPONENTS` thiếu Menu/Fruit/Online/
   Storage/Voucher), y hệt tình huống từng xảy ra với CashFlow trước đây.
   Đã import và gắn lại đầy đủ 9 trang.
2. **[Crash tiềm ẩn] `ImageUploadField.js` dùng API đã bị loại bỏ** —
   `ImagePicker.MediaTypeOptions.Images` không còn tồn tại ở bản
   expo-image-picker đang dùng (chính `StoragePage.js` trong dự án đã tự
   phát hiện và chuyển sang `mediaTypes: ["images"]` ở một phiên khác, nhưng
   `ImageUploadField.js` — dùng chung cho ảnh món ăn ở Menu và ảnh trái cây
   ở Fruit — bị bỏ sót). Đã đồng bộ theo API mới.
3. **[Điều hướng gãy] `resetToLogin()` reset về route `"Auth"` không tồn
   tại** — `RootNavigator.js` chỉ đăng ký thẳng route `"Login"`, không có
   navigator con nào tên "Auth". Khi gặp lỗi 401, lệnh reset điều hướng sẽ
   thất bại. Đã sửa về đúng tên route `"Login"`.
4. **[401 tiềm ẩn] `exportJSON.js`/`importJSON.js` gọi axios trần, không
   gắn Bearer token** — khác với toàn bộ phần còn lại của app (đều đi qua
   `callAPI.js` hoặc tự gắn token thủ công). Nếu backend yêu cầu đăng nhập
   cho các route này (nhiều khả năng có), xuất/nhập JSON sẽ luôn lỗi 401.
   Đã gắn thêm header Authorization từ `useAuthZustand`.
5. **[Bẫy logic ẩn] `hasPendingChanges`/`pendingCount` trong
   `useIngredientZustand.js` dùng cú pháp getter (`get propName()`)** —
   zustand dùng `Object.assign({}, state, partial)` mỗi lần `set()`, thao
   tác này "đông cứng" giá trị getter thành 1 field tĩnh ngay tại lần
   `set()` đầu tiên, không bao giờ cập nhật lại. Chưa gây lỗi hiển thị vì
   hiện chưa có chỗ nào dùng 2 field này, nhưng là bẫy chờ sẵn. Đã đổi
   sang dạng hàm giống `useFoodZustand`/`useFruitZustand`.
6. **[Đăng nhập nhiều người/1 thiết bị] `logout()`/`clearAuth()` không
   reset `isWorking` về `true`** — xác nhận đây là lỗi thật, không phải suy
   đoán: `AppHeader.js` có nút "Đang hoạt động/Đã tạm dừng" (gọi
   `stopWorking()`) hiện ở MỌI màn hình. Nếu 1 nhân viên bấm tạm dừng ca rồi
   đăng xuất mà không tắt app — tình huống rất dễ xảy ra với tablet/điện
   thoại dùng chung ở quầy — người đăng nhập kế tiếp trên cùng thiết bị sẽ
   bị chặn nhầm ở màn Forbidden dù chưa từng tạm dừng ca. Đã thêm
   `isWorking: true` vào cả `logout()` và `clearAuth()`.
7. **[Nhất quán module] `mathUtils.js` dùng cú pháp CommonJS
   (`exports.foo = ...`) giữa dự án 100% ES Module** — chưa gây lỗi vì
   chưa có trang nào import file này (dành cho Analyst/chart sau này), Metro
   vẫn resolve đúng nhờ CJS interop, nhưng lẫn 2 kiểu cú pháp dễ gây nhầm
   lẫn. Đã đổi sang `export const ...` cho nhất quán.

## Cần bạn xem xét thêm (chưa tự sửa vì cần biết ý đồ nghiệp vụ gốc)

- **`utils/socket.js` gọi `io(...)` ngay khi module được load** (do
  `autoConnect: true` và import tĩnh), tức là kết nối socket có thể được
  thiết lập trước cả khi người dùng đăng nhập, ngay lúc app khởi động (vì
  giờ OnlineOrdersPage đã được gắn vào Drawer nên import này chắc chắn chạy
  ở đầu app). Cần kiểm tra backend có chấp nhận kết nối socket
  chưa-xác-thực hay không — nếu không, cân nhắc dời `io()` vào lúc đăng
  nhập thành công thay vì ở module scope.
- **`FruitPage.js`/`IngredientsPage.js`/`MenuPage.js` gọi thẳng
  `exportJSON(`${API_URL}/api/...`, ...)`** — endpoint đích là chính
  `/api/ingredients`, `/api/foods`, `/api/fruits` (không phải `/export`),
  còn `importJSON` lại POST tới `${apiUrl}/import`. Nên xác nhận lại với
  backend đây có đúng là 2 route khác nhau (GET nguyên endpoint để export,
  POST `/import` riêng để import) hay là điểm không nhất quán cần chuẩn hoá.

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
  pages/        — màn hình (9/13 đã xong: LoginPage, RegisterPage, HomePage,
                  CashFlow, Customers, Ingredients, Menu, Fruit, Online,
                  Storage, Voucher; còn Orders/Analyst/StaffManager/Kitchen
                  là PlaceholderPage)
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
