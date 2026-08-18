// routes/voucherRoute.js
const express = require("express");
const router = express.Router();
const VoucherController = require("../../controllers/VoucherController");
const authMiddleware = require("../middleware/auth.middleware"); // đổi path nếu khác

router.post("/validate", VoucherController.validateVoucher); // public, giống pattern /fruit-orders/top-combos

router.get("/stats", authMiddleware, VoucherController.getVoucherStats);
router.get("/:id", authMiddleware, VoucherController.getVoucherById);
router.post("/", authMiddleware, VoucherController.createVoucher);
router.get("/", authMiddleware, VoucherController.getVouchers);
router.patch("/:id", authMiddleware, VoucherController.updateVoucher);
router.delete("/:id", authMiddleware, VoucherController.deleteVoucher);

module.exports = router;