# Đồng bộ backend: Khách tự huỷ đơn (`cancel_order`)

Tài liệu này mô tả riêng phần thay đổi để thêm nút "Huỷ đơn" phía khách.
Không thay đổi gì tới các sự kiện đã có (`join_customer`, `customer_orders_state`,
`place_order`, chat...) — chỉ **thêm mới 1 sự kiện Socket.IO**.

## Tóm tắt

Khách bấm "Huỷ đơn" trên `/orders` → FE emit sự kiện `cancel_order` **kèm ACK
callback** → backend kiểm tra hợp lệ rồi trả kết quả ngay qua callback đó, sau
đó nếu huỷ thành công thì phát lại `customer_orders_state` như bình thường để
mọi tab/thiết bị của khách đó cùng cập nhật.

Khác với `place_order` (bắn xong không chờ phản hồi, tin tưởng đơn sẽ tự xuất
hiện qua `customer_orders_state`), `cancel_order` **cần phản hồi tức thì**
(thành công/thất bại) vì có thể xảy ra tranh chấp thời điểm: khách bấm huỷ
đúng lúc quán vừa xác nhận bắt đầu chuẩn bị món.

## 1. Điều kiện được phép huỷ

Khách chỉ được tự huỷ khi đơn đang ở trạng thái:

- `pending` (chờ xác nhận), hoặc
- `confirmed` (đã xác nhận, quán chưa bắt đầu làm)

Từ `preparing` trở đi (`preparing`, `delivering`, `completed`) → **không cho
huỷ qua app nữa**, khách cần gọi điện trực tiếp cho quán.

⚠️ **Frontend chỉ ẩn nút dựa theo trạng thái đã biết ở client — đây là gợi ý
UI, không phải cơ chế bảo mật.** Backend **bắt buộc phải tự kiểm tra lại**
trạng thái mới nhất trong DB tại thời điểm xử lý sự kiện, không tin trạng thái
mà client "nghĩ" là đúng lúc bấm nút (client có thể đang xem dữ liệu cũ vài
trăm ms do độ trễ mạng).

## 2. Sự kiện `cancel_order` (Client → Server)

```json
{
  "customerId": "b3f1c2a0-...-uuid",
  "orderId": "64f...(Mongo ObjectId của Order)"
}
```

Gửi kèm **ack callback** (tham số thứ 3 của `socket.emit`) — bắt buộc server
phải gọi callback này, không chỉ broadcast rồi thôi:

```js
socket.emit("cancel_order", { customerId, orderId }, (response) => {
  // response = { ok: true } hoặc { ok: false, message: "..." }
});
```

### Xử lý phía server (gợi ý)

```js
socket.on("cancel_order", async ({ customerId, orderId }, callback) => {
  const ack = typeof callback === "function" ? callback : () => {};

  const order = await Order.findById(orderId);

  if (!order) {
    return ack({ ok: false, message: "Không tìm thấy đơn này." });
  }
  if (order.customerId !== customerId) {
    // Không phải chủ đơn — ai đó đang thử đoán orderId của người khác.
    return ack({ ok: false, message: "Không tìm thấy đơn này." });
  }
  if (!["pending", "confirmed"].includes(order.status)) {
    return ack({
      ok: false,
      message: "Đơn đã được chuẩn bị, vui lòng gọi điện cho quán để huỷ.",
    });
  }

  order.status = "cancelled";
  order.updatedAt = new Date();
  await order.save();

  ack({ ok: true });

  // Phát lại state như mọi lần đổi trạng thái khác, để mọi tab của khách
  // (và trang admin nếu đang mở đơn này) cùng thấy ngay.
  const allOrders = await Order.find({ customerId }).sort({ createdAt: -1 });
  io.to(`customer:${customerId}`).emit("customer_orders_state", allOrders);

  // Nếu trang admin lắng nghe theo phòng riêng (vd "admin_room" hoặc
  // "order:<id>"), phát thêm ở đó để admin thấy đơn vừa bị khách tự huỷ.
  io.to("admin_room").emit("order_cancelled_by_customer", { orderId, customerId });
});
```

### Response khi thất bại — gợi ý các trường hợp cần xử lý

| Tình huống                                   | `message` gợi ý                                              |
| --------------------------------------------- | -------------------------------------------------------------- |
| Không tìm thấy đơn / không phải chủ đơn       | "Không tìm thấy đơn này."                                     |
| Đơn đã ở `preparing`/`delivering`/`completed` | "Đơn đã được chuẩn bị, vui lòng gọi điện cho quán để huỷ."     |
| Đơn đã `cancelled` từ trước                   | "Đơn này đã được huỷ trước đó."                                |

Text cụ thể tuỳ backend chọn — FE chỉ hiển thị nguyên văn `message` nhận được
lên toast, không tự diễn giải thêm.

## 3. Timeout phía client

FE đã có sẵn timeout dự phòng 8 giây: nếu server không gọi `callback` trong
8 giây (vd chưa deploy kịp, hoặc lỗi không bắt được), FE tự coi là thất bại và
báo "Server không phản hồi, vui lòng thử lại." — **không tự ý coi là thành
công**. Vì vậy dù có xảy ra lỗi bất ngờ ở server, luôn ưu tiên gọi `callback`
(kể cả trong nhánh `catch`/`try-finally`) thay vì để request "treo".

## 4. Không cần thay đổi gì ở các sự kiện khác

- `customer_orders_state` giữ nguyên cấu trúc Order như cũ, chỉ cần đảm bảo
  `status: "cancelled"` được set đúng khi phát lại.
- Không cần thêm event mới nào khác cho luồng chính (đặt đơn, chat) — chỉ
  thêm đúng 1 listener `cancel_order` như mô tả ở trên.

## 5. File frontend đã thay đổi (tham khảo, không cần backend đụng vào)

| File                                          | Thay đổi                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `src/constants/orderStatus.js`                 | Thêm `CANCELLABLE_ORDER_STATUSES = ["pending", "confirmed"]`             |
| `src/context/SocketContext.jsx`                 | Thêm `cancelOrder(orderId)` — emit `cancel_order` kèm ack + timeout 8s   |
| `src/components/order/OrderCard.jsx`            | Thêm nút "Huỷ đơn" + hàng xác nhận inline, chỉ hiện khi `canCancel`      |
