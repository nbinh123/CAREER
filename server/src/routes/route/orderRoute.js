const express = require("express")
const router = express.Router()
// nạp file HomeController
const OrderController = require("../../controllers/OrderController")
const authMiddleware = require("../middleware/auth.middleware")

router.get("/", OrderController.getOrders)
router.post("/", OrderController.createOrder)
router.get("/online/history", authMiddleware, OrderController.getHistory)
// cập nhật thêm cancel order
module.exports = router