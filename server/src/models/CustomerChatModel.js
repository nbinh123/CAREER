// models/CustomerChatModel.js
//
// Lịch sử chat hỗ trợ của luồng đặt online — gắn theo customerId (khách ẩn
// danh), KHÔNG theo tableId như bản tại bàn. Mỗi customerId có đúng 1
// document, "messages" là mảng tăng dần theo thời gian — cùng mô hình với
// Table.messages ở bản tại bàn, chỉ khác đơn vị theo dõi.
//
// "read" dùng để đếm số tin chưa đọc cho danh sách hội thoại phía admin,
// giống hệt cơ chế mark_chat_read của bản tại bàn.
//
// "customerName" được đồng bộ mỗi khi khách đặt đơn (xem handler
// "place_order" trong socket.js) — vì bản thân sự kiện chat không mang tên
// khách, chỉ có customerId. Trước khi khách đặt đơn lần đầu, tên sẽ rỗng và
// admin sẽ thấy customerId rút gọn thay cho tên.

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const chatMessageSchema = new Schema(
    {
        from: { type: String, enum: ["customer", "admin"], required: true },
        text: { type: String, required: true },
        at: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
    },
    { _id: true }
);

const customerChatSchema = new Schema(
    {
        customerId: { type: String, required: true, unique: true, index: true },
        customerName: { type: String, default: "" },
        messages: { type: [chatMessageSchema], default: [] },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CustomerChat", customerChatSchema);