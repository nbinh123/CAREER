// telegram/services/subscriber.service.js
//
// CRUD nhỏ cho TelegramSubscriber — mọi nơi cần đọc/ghi trạng thái
// đăng ký nhận thông báo đều đi qua đây, không query Model trực tiếp
// rải rác ở các callback.

const Subscriber = require("../models/subscriber.model");

// Gọi mỗi lần /start — tạo mới nếu chưa có, cập nhật lastSeenAt nếu đã có.
// notifyNewOrder chỉ set lúc TẠO MỚI (upsert), không đụng vào lựa chọn
// bật/tắt cũ của người dùng khi họ /start lại lần 2.
async function upsertSubscriber(chatId, { firstName, username } = {}) {
    return Subscriber.findOneAndUpdate(
        { chatId: String(chatId) },
        {
            $set: {
                firstName: firstName || "",
                username: username || "",
                lastSeenAt: new Date(),
            },
            $setOnInsert: { notifyNewOrder: true },
        },
        { upsert: true, new: true }
    );
}

async function isSubscribed(chatId) {
    const sub = await Subscriber.findOne({ chatId: String(chatId) });
    return sub ? sub.notifyNewOrder !== false : false;
}

// Đảo trạng thái bật/tắt, trả về trạng thái MỚI (true/false).
// Trả về null nếu người này chưa từng /start (chưa có record).
async function toggleNotify(chatId) {
    const sub = await Subscriber.findOne({ chatId: String(chatId) });
    if (!sub) return null;

    sub.notifyNewOrder = !sub.notifyNewOrder;
    await sub.save();
    return sub.notifyNewOrder;
}

// Danh sách chatId đang MỞ nhận thông báo — dùng khi broadcast "đơn mới".
async function getActiveSubscriberChatIds() {
    const subs = await Subscriber.find({ notifyNewOrder: true }, { chatId: 1 });
    return subs.map((s) => s.chatId);
}

module.exports = {
    upsertSubscriber,
    isSubscribed,
    toggleNotify,
    getActiveSubscriberChatIds,
};
