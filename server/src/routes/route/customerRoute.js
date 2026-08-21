const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/* =========================================================
   CONTROLLERS
========================================================= */
const CustomerController = require("../../controllers/CustomerController");

/* =========================================================
   MIDDLEWARES
========================================================= */
// Xác thực KHÁCH HÀNG (app mobile) — KHÔNG dùng chung với
// specialMiddleware/authMiddleware của nhân viên (mục 3.4)
const customerAuthMiddleware = require("../middleware/customerAuthMiddleware");

// Xác thực NHÂN VIÊN — dùng lại nguyên middleware đang có sẵn cho các route
// [Admin] bên dưới (danh sách/khoá/mở khoá/reset mật khẩu khách hàng do
// nhân viên thao tác trên trang quản lý, không phải khách tự làm)
const specialMiddleware = require("../middleware/specialMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");

/* =========================================================
   RATE LIMIT — chống brute-force cho /login, /register (mục 3.6)
   Tối đa 10 lần / 15 phút theo IP.
========================================================= */
const customerAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Quá nhiều yêu cầu, vui lòng thử lại sau ít phút",
    },
});

/* =========================================================
   AUTH (khách hàng tự thao tác)
========================================================= */

// Đăng ký
router.post("/register", customerAuthLimiter, CustomerController.register);

// Đăng nhập
router.post("/login", customerAuthLimiter, CustomerController.login);

// Cấp lại access token
router.post("/refresh-token", CustomerController.refreshAccessToken);

// Đăng xuất thiết bị hiện tại
router.post("/logout", customerAuthMiddleware, CustomerController.logout);

// Đăng xuất toàn bộ thiết bị
router.post(
    "/logout-all",
    customerAuthMiddleware,
    CustomerController.logoutAllDevices
);

/* =========================================================
   TÀI KHOẢN (khách hàng tự thao tác)
========================================================= */

// Lấy thông tin tài khoản đang đăng nhập
router.get("/me", customerAuthMiddleware, CustomerController.getMe);

// Tự cập nhật tên / địa chỉ
router.patch("/me", customerAuthMiddleware, CustomerController.updateMe);

// Đổi mật khẩu (biết mật khẩu cũ)
router.put(
    "/me/password",
    customerAuthMiddleware,
    CustomerController.changePassword
);

// Lịch sử đơn của tài khoản
router.get("/me/orders", customerAuthMiddleware, CustomerController.getMyOrders);

/* =========================================================
   [ADMIN] Quản lý khách hàng — nhân viên thao tác trên trang admin (mục 4)
========================================================= */

// Danh sách khách hàng, tìm theo SĐT/tên
router.get(
    "/",
    // specialMiddleware,
    // authorizeRoles("admin", "manager"),
    CustomerController.adminGetCustomers
);

// Khoá tài khoản
router.patch(
    "/:id/lock",
    specialMiddleware,
    authorizeRoles("admin", "manager"),
    CustomerController.adminLockCustomer
);

// Mở khoá tài khoản
router.patch(
    "/:id/unlock",
    specialMiddleware,
    authorizeRoles("admin", "manager"),
    CustomerController.adminUnlockCustomer
);

// Reset về mật khẩu tạm 6 số
router.post(
    "/:id/reset-password",
    specialMiddleware,
    authorizeRoles("admin", "manager"),
    CustomerController.adminResetPassword
);

module.exports = router;
