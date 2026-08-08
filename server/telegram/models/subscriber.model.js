// telegram/models/subscriber.model.js
//
// Danh sách chatId Telegram đã /start bot, kèm trạng thái bật/tắt nhận
// thông báo "có đơn mới". Tách riêng khỏi UserModel (tài khoản đăng
// nhập web) vì bot hiện chưa gắn với 1 nhân viên cụ thể nào — ai /start
// và được isAuthorized() cho qua đều được lưu vào đây.
//
// Dùng chung kết nối Mongoose với phần còn lại của server (db.connect()
// trong express.js) — model chỉ define schema, Mongoose tự buffer các
// lệnh cho tới khi kết nối xong nên không cần chờ thủ công ở đây.

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const subscriberSchema = new Schema(
    {
        // Lưu dạng String cho gọn (chatId Telegram là số nhưng không
        // dùng để tính toán, chỉ để định danh + gọi sendMessage).
        chatId: {
            type: String,
            required: true,
            unique: true,
        },
        firstName: { type: String, default: "" },
        username: { type: String, default: "" },

        // Bật/tắt nhận thông báo "có đơn mới" — điều khiển bằng nút
        // 🔔/🔕 ở menu chính.
        notifyNewOrder: { type: Boolean, default: true },

        lastSeenAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model("TelegramSubscriber", subscriberSchema);
