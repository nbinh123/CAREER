# Quán Ba Miền · Đặt món online

Bản frontend đặt món **online** (không qua bàn/QR), tách ra từ dự án gốc
"gọi món tại bàn" để host trên domain riêng. Khách gửi đơn kèm tên, số điện
thoại, địa chỉ, ghi chú — theo dõi trạng thái đơn **realtime qua Socket.IO**.
Thực đơn và trang Mix combo trái cây giữ nguyên giao diện như bản gốc; trái
cây sau khi ghép được gộp vào giỏ hàng chung, đặt cùng lúc với món ăn.

Đây là bản dựng lại từ dự án `Client` (gọi món tại bàn) do người dùng cung
cấp — xem mục "Khác gì so với bản gốc" bên dưới để biết chính xác phần nào
giữ nguyên, phần nào đổi.

## Chạy thử

```bash
npm install
npm run dev
```

Cần backend đang chạy ở `http://localhost:5000` (đổi qua `.env`:
`VITE_API_URL` / `VITE_SOCKET_URL` nếu khác). Mở `http://localhost:5173` —
vào thẳng thực đơn, không cần quét QR hay xác thực gì cả.

⚠️ **Backend cho luồng online này chưa tồn tại** (dự án gốc chỉ có backend
cho luồng tại bàn). Mục "Hợp đồng Socket.IO" bên dưới mô tả đầy đủ các sự
kiện mà backend cần hiện thực để frontend này chạy đúng.

## Cấu trúc thư mục

```
src/
  api/            axiosClient.js, foodApi.js, fruitApi.js — gọi REST API (giữ nguyên bản gốc)
  components/
    common/       Button, Tooltip, Loading, Toast (giữ nguyên bản gốc)
    menu/         CategoryTabs, MenuItemCard, FoodThumbnail (giữ nguyên bản gốc)
    cart/         CartFloatingButton, CartItem (giữ nguyên) + CartDrawer (viết lại: 2 bước)
    checkout/     CheckoutFields.jsx — form tên/SĐT/địa chỉ/ghi chú + nút "Lưu thông tin" (MỚI)
    fruit/        FruitPickCard, ComboSuggestions, FlyingFruit (giữ nguyên) + FruitMixBar (đổi hành vi nút)
    chat/         ChatWidget.jsx, ChatBubble.jsx — chat hỗ trợ, gắn theo customerId thay vì tableId
    order/        OrderItemRow (bỏ badge trạng thái theo món) + OrderCard.jsx (MỚI, 1 thẻ = 1 đơn)
  layout/
    header/       Header.jsx — bỏ badge "Bàn X", thêm chấm báo trạng thái kết nối
    body/         Body.jsx — bỏ TableGuard, vào thẳng được mọi route
    footer/       Footer.jsx — 3 tab: Thực đơn / Trái cây / Đơn hàng
  context/
    GlobalContext.jsx     thông tin quán, toast (giữ nguyên bản gốc)
    CustomerContext.jsx   MỚI — thay TableContext+GuestContext: customerId ẩn danh + hồ sơ khách
    CartContext.jsx       giỏ hàng đang chọn (giữ nguyên bản gốc)
    SocketContext.jsx     viết lại — join theo customerId thay vì tableId, nhận mảng orders
  hooks/          useFoods, useFruits, useDebounce (giữ nguyên) + useCart/useSocket/useCustomer (re-export)
  pages/          MenuPage (đổi tên từ OrderPage), FruitPage (giữ giao diện, đổi hành vi gửi),
                  OrdersPage (đổi tên từ HistoryPage), NotFoundPage
  constants/      routes.js (3 route) + orderStatus.js (trạng thái theo ĐƠN, không phải theo món)
  utils/          formatCurrency.js, formatTime.js, bestSellers.js, fruit.js (giữ nguyên bản gốc)
  config/         api.js — API_URL dùng riêng cho fetch trực tiếp /api/fruits/combo (giữ nguyên bản gốc)
```

## Các route

| Path      | Mô tả                                                          |
| --------- | --------------------------------------------------------------- |
| `/`       | Thực đơn (fetch từ `GET /api/foods`), thêm món, đặt hàng         |
| `/fruits` | Mix combo trái cây — giao diện y hệt bản gốc, ghép xong THÊM VÀO GIỎ HÀNG CHUNG thay vì gửi thẳng đơn |
| `/orders` | Danh sách đơn đã đặt của khách này, trạng thái cập nhật realtime |

Không có bước xác thực nào trước khi vào — khác hẳn bản gốc (yêu cầu quét QR
kèm token). Quyền "xem đơn của ai" giờ dựa vào `customerId` ẩn danh sinh ra
và lưu trong `localStorage` của trình duyệt (xem `CustomerContext.jsx`).

## Khác gì so với bản gọi món tại bàn

| Bản tại bàn                                             | Bản online                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Vào qua `?table=<id>`, xác thực qua `TableGuard`          | Vào thẳng, không xác thực                                            |
| Đơn vị theo dõi: **1 bàn** (`tableId`)                    | Đơn vị theo dõi: **1 khách ẩn danh** (`customerId`, lưu `localStorage`) |
| Nhập tên/SĐT một lần khi vào bàn (`GuestInfoPage`)        | Nhập tên/SĐT/địa chỉ/ghi chú trong `CartDrawer` lúc đặt hàng; có nút riêng "Lưu thông tin để dùng cho lần sau" |
| Trạng thái theo **từng món**: pending/cooking/ready       | Trạng thái theo **cả đơn**: pending/confirmed/preparing/delivering/completed/cancelled |
| Trang Trái cây tự trộn (`/fruits`) gửi đơn thẳng lên server ngay khi ghép xong | Trang Trái cây tự trộn (`/fruits`) — **giao diện y hệt bản gốc**, nhưng ghép xong sẽ THÊM VÀO GIỎ HÀNG CHUNG, gộp chung với món ăn và đặt 1 lần duy nhất |
| Chat hỗ trợ gắn theo **1 bàn** (mọi khách cùng bàn thấy chung 1 hội thoại) | Chat hỗ trợ gắn theo **1 khách ẩn danh** (`customerId`) — riêng tư theo từng trình duyệt |
| Lịch sử chat bị xoá khi admin thanh toán bàn (`chat_cleared`)              | Không có khái niệm "thanh toán" nào để xoá — lịch sử chat tồn tại lâu dài theo `customerId` |
| Nhiều khách cùng bàn thấy chung 1 trạng thái              | Chỉ trình duyệt đã đặt đơn mới thấy đơn đó                            |

**Về Trái cây tự trộn**: đã đưa trở lại thành một trang riêng (`/fruits`), giữ
nguyên toàn bộ giao diện của bản gốc (lưới chọn trái cây, gợi ý combo, thanh
mix + animation "bay"). Khác biệt duy nhất nằm ở hành động cuối: thay vì gửi
thẳng đơn lên server, combo được thêm vào `CartContext` — giỏ hàng dùng chung
với các món ăn thường — nên khách chỉ cần đặt hàng 1 lần duy nhất (kèm
tên/SĐT/địa chỉ/ghi chú) cho cả món ăn lẫn trái cây. Giá vẫn luôn cố định
35.000đ/phần bất kể tự mix hay chọn combo có sẵn, và chỉ những combo **đã có
trong thực đơn** (khớp `matchedCombo`) mới thêm vào giỏ được — tự mix ra một
tổ hợp lạ chưa từng bán sẽ báo lỗi giống hệt bản gốc.

**Về Chat**: đã thêm lại (`ChatWidget.jsx`/`ChatBubble.jsx`), giao diện và
tương tác giữ nguyên bản gốc (nút tròn nổi góc dưới-phải, mở ra khung chat
kiểu tin nhắn). Khác biệt: gắn theo `customerId` thay vì `tableId`, nên lịch
sử chat là RIÊNG của từng trình duyệt/khách chứ không dùng chung cho cả bàn.
Bản gốc dùng cơ chế pub-sub (`onChatMessage`/`onChatReset`) trên
`SocketContext` một phần để xử lý "xoá sạch khi thanh toán bàn" — vì bản
online không có khái niệm "thanh toán" nào tương đương, `messages` giờ là
một state mảng bình thường trong `SocketContext` (đơn giản hơn, cùng mô hình
với `orders`). Cũng bỏ `chatEnabled` (nút admin bật/tắt chat theo bàn) vì
không nằm trong yêu cầu — có thể thêm lại sau nếu cần khoá chat theo khách.

## Hợp đồng Socket.IO (backend cần hiện thực)

Áp dụng cùng nguyên tắc bảo mật/tính giá của backend gốc (`initSocket.js`):
**server luôn tự tính lại đơn giá/tổng tiền từ DB theo `foodId`, không tin số
liệu client gửi lên.**

1. Khách kết nối socket → emit `join_customer` `{ customerId }` để vào phòng
   riêng `customer:<customerId>`.
2. Server trả ngay **`customer_orders_state`**: mảng tất cả đơn (mọi trạng
   thái, mới nhất trước) thuộc `customerId` này, mỗi đơn có dạng:
   ```json
   {
     "id": "...",
     "customerId": "...",
     "customerName": "Nguyễn Văn A",
     "phone": "0901234567",
     "address": "123 Lê Lợi, Q.1",
     "note": "Giao trước 12h",
     "items": [
       { "foodId": "...", "foodName": "Phở bò", "unitPrice": 45000, "quantity": 2 }
     ],
     "totalPrice": 90000,
     "status": "pending",
     "createdAt": "2026-08-07T09:00:00.000Z",
     "updatedAt": "2026-08-07T09:00:00.000Z"
   }
   ```
3. Đặt đơn mới: khách emit **`place_order`**
   `{ customerId, customerName, phone, address, note, items: [{ foodId, quantity }] }`.
   Server tạo Order mới (`status: "pending"`), rồi bắn lại
   `customer_orders_state` cho đúng room khách đó — đơn mới tự xuất hiện ở
   `/orders`, frontend không tự thêm optimistic.
4. Trang quản lý (chưa nằm trong dự án này) xác nhận/chuyển trạng thái đơn
   (`pending → confirmed → preparing → delivering → completed`, hoặc
   `→ cancelled`) → mỗi lần đổi, server bắn lại `customer_orders_state` cho
   room khách đó. Frontend tự phát hiện đơn nào vừa đổi trạng thái để hiện
   toast (xem `SocketContext.jsx`).
5. Chat hỗ trợ: ngay sau `join_customer`, server còn bắn thêm
   **`chat_history`** — mảng toàn bộ tin nhắn cũ của `customerId` này, nạp
   đúng 1 lần:
   ```json
   [
     { "id": "...", "from": "customer", "text": "Cho mình hỏi...", "at": "2026-08-08T09:00:00.000Z" },
     { "id": "...", "from": "admin", "text": "Dạ quán trả lời...", "at": "2026-08-08T09:01:00.000Z" }
   ]
   ```
   Khách gửi tin mới: emit **`send_chat_message`** `{ customerId, text }`.
   Server lưu DB rồi bắn lại **`chat_message`** (1 tin nhắn, cùng dạng object
   như trên) cho đúng room `customer:<customerId>` — bao gồm cả tin của
   chính khách (để đồng bộ nếu khách mở nhiều tab) lẫn tin admin trả lời.
   Không có sự kiện xoá lịch sử nào — chat tồn tại lâu dài theo `customerId`.

Toàn bộ logic nhận/gửi các sự kiện trên nằm trong `src/context/SocketContext.jsx`,
có chú thích chi tiết ngay trong code.

### REST endpoint cho trang Trái cây (không phải Socket.IO)

`FruitPage.jsx` vẫn gọi 2 API REST như bản gốc, không đổi gì:
- `GET /api/fruits` → `{ success, data: Fruit[] }` — danh sách loại trái cây lẻ
- `GET /api/fruits/combo` → `{ success, count, data: Food[] }` — các combo **đã
  có sẵn trong thực đơn** (Food document có `categoryId === "Trái cây mix"`,
  `foodName` dạng `"Xoài - Ổi - Mận"`)

`FRUIT_COMBO_PRICE` (35.000đ, khai báo ở `src/utils/fruit.js`) phải khớp với
giá trị backend dùng để tính `unitPrice` thật khi tạo Order — client chỉ gửi
`foodId`, không gửi giá.

## Chưa làm / cần lưu ý khi lên production

- **Backend luồng online**: chưa tồn tại, cần viết mới theo hợp đồng ở trên
  (Order model + 2 sự kiện `join_customer`/`place_order` + logic phát lại
  `customer_orders_state`).
- **Không có xác thực/giới hạn**: bất kỳ ai biết `customerId` (một UUID ngẫu
  nhiên) đều xem được đơn tương ứng — đủ an toàn cho mục đích "khách tự theo
  dõi đơn của mình trên chính máy họ", nhưng đừng dùng `customerId` làm cơ chế
  bảo mật nghiêm ngặt (không gắn tài khoản/mật khẩu).
- **Số điện thoại**: FE chỉ validate định dạng cơ bản (10-11 số, bắt đầu bằng
  `0` hoặc `+84`), không xác minh OTP.
