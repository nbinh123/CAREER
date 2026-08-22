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

npx expo install --fix   # QUAN TRỌNG: tự đồng bộ version native module theo SDK Expo trên máy bạn

cp .env.example .env     # rồi sửa EXPO_PUBLIC_API_URL trỏ tới backend thật

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

  config/       — API_URL (đọc từ EXPO_PUBLIC_API_URL / app.json extra)

  utils/        — hàm thuần (fmtVND, dateUtils, mathUtils...) + callAPI.js (axios + interceptor)

  service/      — lớp gọi API theo domain (Auth/Food/Fruit/Ingredient/Analyst)

  zustand/      — state management (useAuthZustand có AsyncStorage persist)

  navigation/   — RootNavigator, AppDrawer, AppHeader, CustomDrawerContent, ProtectedScreen, navConfig

  components/   — component dùng chung (AuthBackground, PrimaryButton, StatCard, MiniAreaChart)

  pages/        — màn hình (9/13 đã xong: LoginPage, RegisterPage, HomePage,

                  CashFlow, Customers, Ingredients, Menu, Fruit, Online,

                  Storage, Voucher; còn Orders/Analyst/StaffManager/Kitchen

                  là PlaceholderPage)

  theme/        — tokens.js (bảng màu hex cho chỗ không dùng được className) + fonts.js

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

## Kế hoạch tối ưu hiệu năng React Native / Expo

Phần này chỉ bổ sung các hạng mục tối ưu hiệu năng cho project hiện tại. Không thay đổi, ghi đè hoặc loại bỏ các nội dung, quyết định kỹ thuật và trạng thái đã nêu ở các phần phía trên.

Mục tiêu là chia việc tối ưu thành 2 tầng:

Global Optimization — thực hiện một lần cho toàn hệ thống.

Page / Component Optimization — áp dụng riêng cho từng trang/component sau khi global optimization hoàn tất.

1. Global Optimization — tối ưu toàn cục

Các hạng mục dưới đây nên được kiểm tra ở cấp kiến trúc/project, tránh lặp lại việc cấu hình khác nhau ở từng page.

1.1. API Layer / callAPI.js

Kiểm tra và tối ưu:

Chỉ sử dụng Axios instance dùng chung.

Không tạo Axios instance riêng trong từng page/component.

Kiểm tra request/response interceptor.

Kiểm tra việc tự động gắn Bearer token.

Xử lý 401/403 tập trung.

Tránh retry request không cần thiết.

Tránh duplicate request.

Kiểm soát timeout.

Hủy request không còn cần thiết khi phù hợp.

Chuẩn hóa error handling.

Không để request cũ tiếp tục gây side effect sau khi screen đã unmount.

Có thể bổ sung request deduplication nếu nhiều component cùng yêu cầu một resource.

Có thể bổ sung cache ở API/data layer nếu phù hợp với tính chất dữ liệu.

Không thay đổi API contract của backend nếu không cần thiết.

Nguyên tắc:

Page / Component
       ↓
Service / callAPI
       ↓
Axios instance dùng chung
       ↓
Backend API

Không để:

Page A → axios riêng
Page B → axios riêng
Page C → axios riêng

1.2. Zustand / Global State

Kiểm tra toàn bộ các store trong src/zustand/.

Tối ưu:

Component chỉ subscribe vào state thực sự cần dùng.

Tránh destructure toàn bộ store nếu component chỉ cần một vài field.

Tránh update global state nếu giá trị thực tế không thay đổi.

Không lưu dataset cực lớn vào Zustand nếu dữ liệu có thể lấy từ server.

Phân biệt global state, local UI state, server data và derived data.

Kiểm tra persist để tránh lưu dữ liệu không cần thiết vào AsyncStorage.

Không persist dữ liệu tạm thời.

Không persist các object/array cực lớn nếu không có lý do.

Kiểm tra các selector gây re-render lan rộng.

Kiểm tra các action tạo object/array mới quá thường xuyên.

Ví dụ ưu tiên:

const user = useAuthZustand((state) => state.user);

thay vì subscribe toàn bộ store khi không cần.

Phân loại:

Zustand
├── Auth / User
├── Cart / global UI state
└── dữ liệu thực sự cần chia sẻ toàn app

Server
├── Orders
├── Analytics
├── Vouchers lớn
├── Inventory lớn
└── các dataset có thể pagination

1.3. Socket.io

src/utils/socket.js cần được xem xét ở cấp toàn cục.

Kiểm tra:

Socket có được tạo ngay khi module import hay không.

Socket có kết nối trước khi user đăng nhập hay không.

Có nhiều socket connection đồng thời không.

Có nhiều listener cho cùng một event không.

Listener có được cleanup không.

Screen unmount có socket.off(...) đúng không.

Logout có xử lý socket phù hợp không.

Login lại trên cùng thiết bị có tạo listener/connection trùng không.

Socket có giữ reference đến dữ liệu lớn không.

Kiến trúc mục tiêu:

Application
    ↓
Shared Socket Instance
    ├── Online Orders
    ├── Voucher / realtime validation
    ├── Notifications
    └── các event realtime khác

Không tạo socket mới chỉ vì một page được render.

Nếu quyết định thay đổi thời điểm io()/connect, phải xác nhận behavior authentication với backend trước khi sửa.

1.4. Navigation

Kiểm tra:

RootNavigator.

AppDrawer.

ProtectedScreen.

Screen lifecycle.

Screen nào nặng.

Screen nào có thể lazy-load.

Screen nào đang fetch data quá sớm.

Screen nào giữ state lớn sau khi rời khỏi màn hình.

Mục tiêu:

App mở
 ↓
Chỉ khởi tạo thứ cần thiết
 ↓
User mở page
 ↓
Page mới tải dữ liệu/page-specific resources

Không fetch dữ liệu nặng của toàn bộ 13 page ngay khi app khởi động.

1.5. Global Image Architecture

Project hiện có nhiều chức năng ảnh như:

ảnh món ăn.

ảnh trái cây.

ảnh hóa đơn.

upload ảnh.

Kiểm tra:

Kích thước ảnh nguồn.

Kích thước ảnh thumbnail.

Compression.

Cache.

Số lượng ảnh render đồng thời.

Ảnh kích thước lớn được giữ trong memory.

Base64.

Upload file không cần thiết.

Preview ảnh quá lớn.

Nếu cần, tạo component dùng chung:

src/components/OptimizedImage.js

Component này có thể xử lý:

URL
↓
cache
↓
thumbnail / appropriate size
↓
render

Không nên để mỗi page tự xây một cơ chế image loading/cache khác nhau.

1.6. Global Rendering Architecture

Kiểm tra các nguồn gây re-render:

Context Provider.

Zustand subscription.

Parent component.

Props object được tạo mới.

Array được tạo mới.

Callback được tạo mới.

State đặt ở cấp quá cao.

Derived state được tính lại không cần thiết.

Các công cụ có thể sử dụng:

React.memo
useMemo
useCallback
Zustand selectors

Nhưng chỉ sử dụng khi có tác động thực tế.

Không biến mọi function thành useCallback() và mọi expression thành useMemo() một cách máy móc.

1.7. Global Memory Management

Kiểm tra toàn project:

Event listener.

Socket listener.

setInterval.

setTimeout.

Subscription.

Keyboard listener.

AppState listener.

Navigation listener.

Promise/request lâu dài.

Image memory.

Zustand persisted data.

Mọi resource có lifecycle phải có cleanup phù hợp.

Mẫu chung:

useEffect(() => {
  // subscribe / listener / timer

  return () => {
    // cleanup
  };
}, []);

1.8. Expo / React Native Configuration

Kiểm tra các file nếu tồn tại:

app.json
app.config.js
eas.json
package.json
babel.config.js
metro.config.js

Kiểm tra:

Hermes.

New Architecture.

Reanimated configuration.

Metro configuration.

Babel configuration.

Production build configuration.

Dependency không cần thiết.

Debug-only configuration.

Bundle size.

Native module version compatibility với Expo SDK.

Không tự ý nâng major version dependency chỉ để tối ưu performance.

Sau thay đổi native dependency phải kiểm tra lại:

npx expo-doctor
npx expo install --fix

theo tình trạng SDK hiện tại.

1.9. Production / Debug Logging

Kiểm tra:

console.log.

console.warn.

log object lớn.

log API response.

log Socket event.

debug code chỉ dùng trong development.

Mục tiêu:

Development
→ debug information đầy đủ

Production
→ chỉ giữ log cần thiết

Không xóa log quan trọng nếu chưa có cơ chế error reporting thay thế.

1.10. Dependency / Bundle Optimization

Kiểm tra:

package không được sử dụng.

package trùng chức năng.

package quá nặng nhưng chỉ dùng cho một tính năng nhỏ.

import toàn bộ library khi chỉ cần một phần.

dependency chỉ phục vụ development nhưng bị đưa vào runtime không cần thiết.

Không tự ý thay thế thư viện hiện tại chỉ vì bundle size nếu chưa đánh giá compatibility và effort migration.

1.11. Server-state / Cache Strategy

Phân biệt:

Local UI State
Global State
Server State
Cached Server State
Derived State

Ví dụ:

Modal mở/đóng
→ Local State

User / Auth
→ Zustand

Danh sách Orders
→ Server State

Dữ liệu đã fetch và còn hiệu lực
→ Cache

filteredOrders
→ Derived State

Không copy cùng một dataset qua quá nhiều tầng:

API
↓
Service
↓
Zustand
↓
useState
↓
useMemo

nếu không cần thiết.

1.12. Global Performance Monitoring

Sau khi tối ưu nên có cách kiểm tra thay vì chỉ đánh giá bằng cảm giác.

Theo dõi:

App startup.

Time to first useful screen.

Screen transition.

API latency.

Số request.

JS thread workload.

UI responsiveness.

List scrolling.

Memory.

Crash/error.

Socket connection count.

Ưu tiên đo trước/sau đối với các thay đổi lớn.

2. Page / Component Optimization — tối ưu riêng

Sau khi hoàn thành Global Optimization, mỗi Page/Component được tối ưu riêng theo các hạng mục dưới đây.

2.1. Render count

Với từng page/component, kiểm tra:

Component render bao nhiêu lần.

Render nào thực sự cần thiết.

State nào gây render.

Parent render có kéo theo child không.

Props có thay đổi reference liên tục không.

Object/array có được tạo lại trong render không.

Nếu phù hợp:

React.memo(...)

Nhưng chỉ áp dụng cho component có lợi ích thực tế.

2.2. FlatList / danh sách lớn

Đối với các page như:

Customers
Ingredients
Menu
Fruit
Online
Storage
Voucher
Orders

kiểm tra việc render list.

Ưu tiên:

<FlatList
  data={data}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
/>

Kiểm tra thêm:

initialNumToRender.

maxToRenderPerBatch.

windowSize.

removeClippedSubviews.

getItemLayout nếu item có chiều cao cố định.

onEndReached.

ListEmptyComponent.

ListFooterComponent.

Không sử dụng cấu hình cực đoan chỉ để giảm số item render ban đầu; phải cân bằng giữa tốc độ hiển thị, RAM và trải nghiệm scroll.

2.3. List Item

Tách item thành component riêng khi cần.

Ví dụ:

VoucherPage
└── VoucherItem

MenuPage
└── FoodItem

OrdersPage
└── OrderItem

Kiểm tra:

React.memo.

Props.

Callback.

Image.

Derived calculations.

State nội bộ.

Một item không nên re-render chỉ vì một item khác trong list thay đổi.

2.4. API request trong Page

Kiểm tra:

useEffect.

dependency array.

navigation focus.

screen mount.

pull-to-refresh.

search.

filter.

pagination.

Tìm:

Page render
→ API
→ state update
→ render
→ API
→ ...

Không để vòng lặp request/render.

2.5. Search / Debounce

Đặc biệt áp dụng cho:

Voucher.

Customers.

Menu.

Orders.

Ingredients.

Nếu search gọi API:

User typing
↓
debounce 300–500ms
↓
API

Nếu search local:

items + query
↓
memoized filtering
↓
FlatList

Không filter/sort dataset lớn nhiều lần trong cùng một render.

2.6. Filter / Sort / Derived Data

Kiểm tra:

filter()
map()
reduce()
sort()
find()
some()
every()

Nếu computation đủ lớn, sử dụng useMemo.

Ví dụ:

const filteredItems = useMemo(() => {
  return items.filter(...);
}, [items, search, filters]);

Không mutate dữ liệu gốc bằng:

items.sort(...)

nếu state/props vẫn đang sử dụng reference đó.

2.7. Pagination

Các page có dataset lớn nên sử dụng:

page + limit

hoặc:

cursor

Ví dụ:

20 records
↓
scroll
↓
20 records tiếp
↓
scroll
↓
20 records tiếp

Kiểm soát:

loading
hasMore
currentPage/cursor
request lock

để onEndReached không tạo nhiều request giống nhau.

2.8. Image trong từng Page

Kiểm tra:

Image size.

Thumbnail.

Cache.

Placeholder.

Fallback.

Số lượng ảnh.

Upload preview.

Đặc biệt tránh:

100 list items
×
ảnh vài MB/item

2.9. useEffect

Với từng page:

Xóa effect không cần thiết.

Sửa dependency.

Cleanup listener.

Cleanup timer.

Cleanup socket.

Tránh dùng effect để tính derived state đơn giản.

Tránh fetch lại khi dependency không thực sự thay đổi.

2.10. Event Handler

Kiểm tra:

onPress.

onChangeText.

onScroll.

onEndReached.

onRefresh.

Gesture.

Đặc biệt:

onScroll
↓
setState mỗi frame
↓
re-render
↓
lag

Nếu cần, sử dụng throttling hoặc kiến trúc xử lý phù hợp để tránh cập nhật JS state quá thường xuyên.

2.11. Modal / Picker / Dropdown

Các component nặng như:

Modal.

IngredientPicker.

Image picker.

Date picker.

Dropdown.

Bottom sheet.

nên:

Chỉ render nội dung khi cần.

Không xử lý dataset lớn khi modal đang đóng.

Không giữ nhiều component nặng cùng lúc.

Cleanup state khi đóng nếu phù hợp.

2.12. Form

Đối với các page CRUD:

Menu
Fruit
Ingredients
Storage
Voucher
Customers
StaffManager

kiểm tra:

Mỗi lần gõ input có render toàn form không.

Validation có chạy quá thường xuyên không.

Image preview có gây render lớn không.

Derived value có tính lại quá nhiều không.

Submit có duplicate request không.

Không reset toàn bộ form nếu chỉ cần cập nhật một field.

2.13. Socket trong từng Page

Nếu page dùng Socket.io:

Mount
↓
register listener

Unmount
↓
remove listener

Ví dụ:

useEffect(() => {
  const handler = (data) => {
    // ...
  };

  socket.on("event", handler);

  return () => {
    socket.off("event", handler);
  };
}, []);

Không đăng ký listener trong body component.

Không tạo socket mới trong page nếu đã có shared socket.

2.14. Charts / Analytics

Đặc biệt với AnalystPage và các chart tương lai:

Không render chart khi chưa có data.

Không truyền dataset lớn nếu chart không cần toàn bộ.

Memoize dữ liệu chart khi computation lớn.

Không tạo object config mới không cần thiết mỗi render.

Hạn chế số điểm dữ liệu hiển thị.

Aggregate dữ liệu ở backend khi có thể.

Không render 10 chart nặng cùng lúc nếu người dùng chỉ nhìn một phần.

Đánh giá lazy rendering cho chart nằm ngoài viewport.

Kiểm tra memory khi chuyển page nhiều lần.

Với chart phức tạp, ưu tiên benchmark thư viện dựa trên dữ liệu thực tế thay vì chỉ chọn thư viện có API dễ dùng.

2.15. Local-first / Pending Changes

Các page như Ingredients/Menu có logic local-first cần kiểm tra:

User thao tác
↓
Local state
↓
pendingChanges
↓
Lưu tất cả
↓
API

Tối ưu:

Không gọi API sau mỗi thay đổi nếu business logic không yêu cầu.

Không clone toàn bộ dataset sau mỗi thao tác.

Chỉ cập nhật record cần thay đổi.

Không render lại toàn bộ list nếu chỉ một item thay đổi.

Khi "Lưu tất cả", tránh gửi duplicate changes.

Xóa pending change sau khi API xác nhận thành công.

2.16. Upload / Import / Export

Đối với Storage/Menu/Fruit/Ingredients:

Kiểm tra:

File size.

Image compression.

JSON size.

Memory khi đọc file.

Memory khi serialize JSON.

UI blocking.

Loading state.

Duplicate submit.

Không load file cực lớn hoàn toàn vào JS memory nếu có cách xử lý streaming/chunking phù hợp với nền tảng và use case.

2.17. Page lifecycle

Mỗi page cần xác định:

Mount
Focus
Blur
Unmount

Không phải dữ liệu nào cũng cần fetch ở mount.

Ví dụ:

Page mở lần đầu
→ fetch

Quay lại page
→ dùng cache nếu còn hợp lệ

Pull refresh
→ fetch lại

Nếu dữ liệu realtime thì dùng Socket thay vì polling liên tục nếu architecture hiện tại phù hợp.

3. Thứ tự ưu tiên khi tối ưu từng Page

Luôn ưu tiên:

1. Memory leak
2. Duplicate API / Socket request
3. FlatList / large list
4. Excessive re-render
5. Large image
6. Heavy computation
7. Search/filter
8. Pagination
9. Modal/form optimization
10. Minor micro-optimizations

Không ưu tiên các micro-optimization nếu page vẫn còn vấn đề về list, request hoặc memory.

4. Ma trận áp dụng cho project hiện tại

Khu vực

Global

Page / Component

callAPI.js

✅

❌

Axios instance

✅

❌

Auth interceptor

✅

❌

Zustand architecture

✅

❌

Zustand selector

✅

✅

Socket instance

✅

❌

Socket listener

⚠️

✅

Navigation

✅

⚠️

Expo/Babel/Metro

✅

❌

Production logging

✅

❌

Image infrastructure

✅

⚠️

Image usage

❌

✅

FlatList

❌

✅

React.memo

❌

✅

useMemo

❌

✅

useCallback

❌

✅

Search debounce

❌

✅

Pagination

❌

✅

Filter/sort

❌

✅

Form

❌

✅

Modal

❌

✅

Chart

❌

✅

Page-specific API

❌

✅

Page lifecycle

❌

✅

Memory leak toàn app

✅

⚠️

Memory leak trong page

❌

✅

5. Quy trình tối ưu đề xuất cho project này

Giai đoạn A — Global

Thực hiện một lần:

1. callAPI
2. Zustand
3. Socket
4. Navigation
5. Image infrastructure
6. Memory lifecycle
7. Expo configuration
8. Logging
9. Dependency/bundle
10. Cache/data architecture

Giai đoạn B — Page

Sau đó lần lượt:

LoginPage
RegisterPage
HomePage
CashFlow
Customers
Ingredients
Menu
Fruit
Online
Storage
Voucher
Orders
Analyst
StaffManager
Kitchen

Mỗi page kiểm tra:

Render
↓
List
↓
API
↓
Data processing
↓
Image
↓
State
↓
Effect
↓
Event
↓
Socket
↓
Memory

Giai đoạn C — Benchmark

Sau khi tối ưu:

Development test
↓
Release/Preview test
↓
Thiết bị thật
↓
Test list lớn
↓
Test API chậm
↓
Test chuyển page nhiều lần
↓
Test logout/login nhiều lần
↓
Test Socket reconnect
↓
Test memory

6. Tiêu chí không được vi phạm

Mọi optimization phải đảm bảo:

Không thay đổi business logic.

Không thay đổi API contract nếu không cần thiết.

Không phá authentication.

Không phá Zustand.

Không phá Socket.io.

Không phá navigation.

Không làm mất dữ liệu.

Không làm mất chức năng.

Không tạo duplicate request.

Không tạo memory leak.

Không tối ưu máy móc.

Không thay đổi kiến trúc lớn nếu chưa có lý do rõ ràng.

Không thêm dependency nặng nếu lợi ích không tương xứng.

Nguyên tắc cuối cùng:

Đo → xác định bottleneck → tối ưu đúng bottleneck → kiểm tra regression → đo lại.

Không tối ưu chỉ dựa trên giả định rằng một kỹ thuật "luôn nhanh hơn".