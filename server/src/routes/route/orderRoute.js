const express = require("express")
const router = express.Router()
// nạp file HomeController
const OrderController = require("../../controllers/OrderController")
const authMiddleware = require("../middleware/auth.middleware")

router.get("/", OrderController.getOrders)
router.post("/", OrderController.createOrder)

module.exports = router