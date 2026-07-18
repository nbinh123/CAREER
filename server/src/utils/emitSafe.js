// utils/emitSafe.js
//
// FoodController cũ dùng `req.io?.emit(...)`, nhưng không có middleware nào
// gắn `req.io = io` (không thấy trong express.js lẫn routes.js) → gần như
// chắc chắn `req.io` luôn là undefined, các sự kiện food_created/updated/
// deleted trước giờ không thực sự bắn ra.
//
// emitSafe lấy trực tiếp instance `io` từ socket.js (qua getIO()) thay vì
// phụ thuộc middleware — dùng được ở bất kỳ controller nào, không cần
// sửa gì ở routes.js.

const { getIO } = require("../../socket/socket");

/**
 * @param {string} event - tên sự kiện socket
 * @param {any} payload - dữ liệu gửi kèm
 * @param {string} [room] - nếu có, chỉ emit tới room này; nếu không, emit toàn bộ client
 */
function emitSafe(event, payload, room) {
    try {
        const io = getIO();
        if (room) io.to(room).emit(event, payload);
        else io.emit(event, payload);
    } catch (err) {
        // Không throw — lỗi socket không được phép làm sập response REST
        console.error(`[emitSafe] Không thể emit "${event}":`, err.message);
    }
}

module.exports = { emitSafe };