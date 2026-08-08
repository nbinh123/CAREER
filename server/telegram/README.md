# Telegram Bot — Ông chủ 🍽️

Bot Telegram cho quản lý quán: xem thống kê doanh thu, đơn hàng, tình
trạng bàn, kho nguyên liệu, và nhận thông báo ngay khi có đơn mới.

## 1. Cài đặt

Cần các package sau (nếu project chưa có thì cài thêm):

```bash
npm install node-telegram-bot-api axios mongoose dotenv
```

`axios`, `mongoose`, `dotenv` gần như chắc chắn đã có sẵn trong project
(được dùng ở nhiều nơi khác trong `src/`), chỉ `node-telegram-bot-api`
là mới.

## 2. Biến môi trường (`.env`)

```env
# Bắt buộc — token bot, lấy từ @BotFather
TELEGRAM_TOKEN=123456:ABC-DEF...

# Không bắt buộc — base URL của API backend. Bỏ trống sẽ tự dùng đúng
# URL đang deploy (đang hard-code trong code cũ). Đặt lại nếu bạn chạy
# bot trỏ vào server khác (VD localhost lúc dev).
TELEGRAM_API_BASE_URL=https://career-tf7j.onrender.com

# Không bắt buộc — danh sách chatId Telegram được phép dùng bot, phân
# tách bởi dấu phẩy. Để trống = ai /start cũng dùng được (bot có số
# liệu doanh thu nên NÊN set khi chạy thật). Lấy chatId bằng cách
# /start bot rồi hỏi @userinfobot, hoặc xem log "chatId" khi test.
TELEGRAM_ADMIN_IDS=111111111,222222222
```

## 3. Kết nối "có đơn mới" → thông báo Telegram

Bot chỉ viết trong thư mục `telegram/`, không tự sửa code trong `src/`.
Để tính năng "nhận thông báo có đơn đến" hoạt động, cần thêm **đúng 2
dòng** vào `src/controllers/OrderController.js` — nơi DUY NHẤT một
`Order` được tạo ra trong toàn bộ backend (áp dụng cho cả đơn tại quán
và đơn online):

```js
// Thêm ở đầu file, cùng chỗ các require khác
const { notifyNewOrder } = require("../../telegram/bot");

class OrderController {
    async createOrder(req, res) {
        // ...code cũ giữ nguyên...

        const newOrder = new Order(orderData);
        await newOrder.save();

        // ❗ THÊM DÒNG NÀY — ngay sau khi lưu đơn thành công
        notifyNewOrder(newOrder).catch(() => {});

        // ...phần response giữ nguyên...
    }
}
```

`notifyNewOrder` tự bỏ qua nếu bot chưa chạy (thiếu `TELEGRAM_TOKEN`)
hoặc chưa ai `/start`, nên thêm vào không có rủi ro làm hỏng luồng tạo
đơn hiện tại.

## 4. Tính năng

- **`/start`** — command DUY NHẤT, mở menu chính (mọi thao tác khác đều
  bấm nút, không có command nào khác).
- **📊 Thống kê** — hôm nay, 7 ngày gần nhất, tuần này/trước, tháng
  này/trước, top món bán chạy.
- **📦 Đơn hàng** — 5 đơn gần nhất, hàng đợi bếp (món đang chờ nấu theo
  từng bàn), tình trạng bàn (trống/đang phục vụ).
- **🥬 Kho nguyên liệu** — nguyên liệu đã hết / cần bổ sung liên tục,
  toàn bộ kho.
- **🔔/🔕 Thông báo đơn mới** — bật/tắt ngay tại menu chính; khi có đơn
  mới (xem mục 3), mọi chatId đang bật sẽ nhận tin nhắn kèm chi tiết
  đơn (bàn/online, món, tổng tiền, thanh toán, ghi chú, thông tin khách
  nếu có).
- Có thể giới hạn ai được dùng bot qua `TELEGRAM_ADMIN_IDS` (mục 2).

## 5. Cấu trúc

```
telegram/
├── bot.js                  # entry point — require 1 lần từ express.js
├── config.js                # đọc biến môi trường
├── commands/
│   ├── index.js
│   └── start.command.js     # /start — command duy nhất
├── callbacks/
│   ├── index.js             # 1 dispatcher cho toàn bộ callback_query
│   ├── menu.callback.js      # điều hướng menu chính ↔ 3 submenu
│   ├── analyst.callback.js   # 📊 Thống kê
│   ├── order.callback.js     # 📦 Đơn hàng
│   ├── storage.callback.js   # 🥬 Kho nguyên liệu
│   └── notify.callback.js    # 🔔/🔕 bật/tắt thông báo
├── keyboards/                # layout các bàn phím inline
├── services/
│   ├── api.service.js        # gọi API backend qua HTTP (axios)
│   ├── subscriber.service.js # CRUD người đăng ký nhận thông báo
│   └── notify.service.js     # soạn + gửi tin "đơn hàng mới"
├── models/
│   └── subscriber.model.js   # Mongoose model riêng cho bot (TelegramSubscriber)
└── utils/
    ├── auth.js                # kiểm tra chatId có trong TELEGRAM_ADMIN_IDS
    └── format.js              # format tiền / ngày giờ / "biểu đồ" text
```

**Đã bỏ so với bản nháp cũ:** command text `/stats` (gộp vào submenu
Thống kê để chỉ còn `/start`), và các file rỗng/trùng lặp
`callbackHandler.js`, `commandHandler.js`, `menu.js` (thay bằng
`keyboards/*.js` + `callbacks/menu.callback.js`).
