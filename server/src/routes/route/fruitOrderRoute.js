const express = require("express")
const router = express.Router()

const FruitOrderController = require("../../controllers/FruitOrderController")

// ⚠️ Route này được gọi TỪ TRANG KHÁCH (FruitPage.jsx, không đăng nhập) để
// lấy gợi ý "combo bán chạy nhất" — KHÔNG gắn authMiddleware vào đây, nếu
// không khách sẽ luôn nhận lỗi 401 và trang Trái cây mất hẳn phần gợi ý.
// Không có route POST ở đây — đơn trái cây được tạo qua socket
// "send_fruit_order" (initSocket.js) để bắn realtime tới admin_room, không
// đi qua REST.
router.get("/top-combos", FruitOrderController.getTopCombos)

module.exports = router