# Quán Ba Miền · Web gọi món qua QR tại bàn

Frontend đặt món realtime cho khách tại bàn, tối ưu cho điện thoại.
Đã nối `axios` (lấy danh sách món) + `socket.io-client` (đồng bộ trạng thái
món ăn realtime) vào backend thật. Các điểm còn thiếu ở backend được đánh
dấu `// TODO` / `⚠️` ngay trong code.

## Chạy thử

```bash
npm install
npm run dev
```

Cần backend đang chạy ở `http://localhost:5000` (đổi qua biến môi trường
`VITE_API_BASE_URL` / `VITE_SOCKET_URL` nếu khác). Mở:

```
http://localhost:5173/?table=3&token=demo123
```

để giả lập quét QR bàn số 3 — **số này phải khớp với `Table.number` (1–12)
đã seed trong MongoDB**, nếu không `join_table` sẽ không tìm thấy bàn nào.
Thử `token=expired` để xem giao diện khi mã QR không hợp lệ.

## Cấu trúc thư mục

```
src/
  api/            axiosClient.js, foodApi.js — gọi REST API (GET /api/foods)
  components/
    common/       Button, Modal, Tooltip, Loading, Toast
    menu/         CategoryTabs, MenuItemCard, MenuItemDetailModal, FoodThumbnail
    cart/         CartFloatingButton, CartDrawer, CartItem
    order/        OrderItemRow — dòng món + badge trạng thái (pending/cooking/ready)
    chat/         ChatWidget, ChatBubble (đang mock, xem mục Chat bên dưới)
    table/        TableGuard, InvalidTablePage
  layout/
    header/       Header.jsx
    body/         Body.jsx   <- toàn bộ <Routes> khai báo ở đây
    footer/       Footer.jsx <- dùng làm bottom nav (Thực đơn / Lịch sử)
  context/
    GlobalContext.jsx   thông tin quán, toast (state thật sự toàn cục)
    TableContext.jsx    xác thực mã bàn từ QR, lưu session (đang mock)
    CartContext.jsx     giỏ hàng đang chọn (client-side, chưa gửi lên server)
    SocketContext.jsx   kết nối Socket.IO THẬT tới backend
  hooks/          useFoods (fetch món ăn), useCart/useTable/useSocket (re-export), useDebounce
  pages/          OrderPage, WaitingPage, HistoryPage, NotFoundPage
  data/           mockMenu.js — CHỈ còn CATEGORIES (danh mục món ăn vẫn tĩnh)
  constants/      routes.js, orderStatus.js (pending/cooking/ready)
  utils/          formatCurrency.js, formatTime.js, bestSellers.js
```

## Các route

| Path              | Mô tả                                                        |
| ----------------- | ------------------------------------------------------------- |
| `/`                | Điểm vào từ QR, xác thực token rồi chuyển sang `/order`       |
| `/order`           | Thực đơn (fetch từ `GET /api/foods`), thêm món, gửi đơn        |
| `/order/waiting`   | Theo dõi món realtime (chờ xác nhận / đang chế biến / sẵn sàng) + chat |
| `/history`         | Nhật ký các món đã gọi trong buổi ngồi hiện tại               |

Không có trang đăng nhập — quyền truy cập hoàn toàn dựa vào `table` + `token`
trên URL của mã QR.

## Luồng đặt món thật (khớp `initSocket.js`)

1. Khách vào `/order`, `OrderPage` gọi `GET /api/foods` lấy thực đơn.
2. Thêm món vào giỏ (client-side, `CartContext`) → bấm "Gửi đơn" trong
   `CartDrawer` → `SocketContext.sendOrder()` emit `send_to_kitchen`
   `{ tableId, items: [{ foodId, quantity }] }`.
3. Server đẩy món vào `pendingItems` của bàn, broadcast lại `tables_state`
   tới đúng phòng `table:<tableId>` mà khách đang join.
4. Admin xác nhận (`confirm_items`) → món chuyển sang `items[]` với
   `status: "cooking"` → khách thấy ngay ở `/order/waiting`.
5. Bếp bấm xong (`mark_item_ready`) → `status: "ready"` → khách thấy món đã
   sẵn sàng, tất cả không cần polling, chỉ nhờ vào sự kiện `tables_state`.

## Chống chụp lại / dùng lại mã QR

Việc này **bắt buộc phải xử lý ở backend**, frontend chỉ chặn UI. Xem chi tiết
trong comment ở đầu file `src/context/TableContext.jsx`. Tóm tắt:

1. QR chứa `?table=<id>&token=<JWT ký bởi server, TTL ngắn>`.
2. Server xoay token mỗi khi nhân viên "mở bàn" cho khách mới trên POS — QR cũ
   (đã bị chụp trước đó) tự động vô hiệu.
3. Lần xác thực đầu tạo ra `sessionId` gắn với phiên dùng bữa.
4. Khi thanh toán / đóng bàn, server huỷ session ngay.
5. Frontend chỉ lưu token/sessionId trong `sessionStorage` (mất khi đóng tab),
   không dùng `localStorage`.

Hàm `verifyTableToken()` trong `TableContext.jsx` **vẫn đang mock** — đây là
phần còn lại chưa nối thật, thay bằng gọi API xác thực khi bạn có endpoint đó.

## Những phần còn hạn chế / cần làm thêm ở backend

- **Ghi chú theo món (note khách tự nhập)**: đã bỏ khỏi UI vì
  `send_to_kitchen` chỉ nhận `{foodId, quantity}`, không có chỗ lưu note
  riêng từng món ở `TableModel`. Muốn thêm lại phải sửa cả
  `initSocket.js` (`send_to_kitchen`, `confirm_items`).
- **Chat với admin** (`ChatWidget`): backend hiện chưa có event
  `chat:send`/`chat:message` trong `initSocket.js`, nên phần này **vẫn đang
  mock cục bộ** (tự trả lời giả sau 1.4s). Thêm 2 event đó ở server rồi thay
  trong `SocketContext.jsx`.
- **Lịch sử đơn** (`/history`): `/api/orders` bên admin trả về tất cả bàn,
  không lọc theo bàn nên không an toàn để gọi từ app khách. Trang này hiện
  chỉ hiển thị nhật ký buổi ngồi hiện tại (cùng dữ liệu với Waiting). Cần
  thêm `GET /api/tables/:tableId/orders` nếu muốn xem lại các lần ghé quán
  trước.
- **Categories**: `categoryId` trong Food schema là string tự do, chưa có
  Category collection riêng — `CATEGORIES` trong `mockMenu.js` vẫn là bảng
  nhãn tĩnh phía FE.

## Responsive / mobile

- Header và bottom nav dùng `fixed` + `env(safe-area-inset-*)` để tương thích
  notch/thanh điều hướng của điện thoại.
- Giỏ hàng và chi tiết món dùng bottom sheet trên mobile (`Modal.jsx` tự chuyển
  sang dialog giữa màn hình ở màn hình rộng hơn `sm:`).
- Chat mở full màn hình trên mobile, thu nhỏ thành panel góc phải trên desktop.
- Danh mục món cuộn ngang, ẩn thanh cuộn (`no-scrollbar`).
