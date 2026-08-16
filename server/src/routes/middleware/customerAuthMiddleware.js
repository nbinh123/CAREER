// middleware/customerAuthMiddleware.js
//
// Xác thực JWT của TÀI KHOẢN KHÁCH HÀNG (app mobile) — tách biệt hoàn toàn
// với authMiddleware.js / specialMiddleware.js đang dùng cho nhân viên.
// Verify bằng secret riêng + claim type:"customer" (xem utils/customerToken.js
// và mục 3.4 kế hoạch) nên token khách sẽ KHÔNG bao giờ lọt qua được
// authorizeRoles() của các route quản trị, và ngược lại token nhân viên cũng
// không verify được ở middleware này.

const Customer = require("../../models/CustomerModel");
const { verifyCustomerAccessToken } = require("../../utils/customerToken");

const customerAuthMiddleware = async (req, res, next) => {
  try {
    /* =========================================================
       GET AUTH HEADER
    ========================================================= */
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token not found",
      });
    }

    /* =========================================================
       VERIFY TOKEN
    ========================================================= */
    const decoded = verifyCustomerAccessToken(token);

    /* =========================================================
       FIND CUSTOMER
    ========================================================= */
    const customer = await Customer.findById(decoded.accountId);

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại",
      });
    }

    /* =========================================================
       CHECK TOKEN VERSION (logout-all sẽ tăng số này lên)
    ========================================================= */
    if (decoded.tokenVersion !== customer.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    /* =========================================================
       CHECK ACCOUNT LOCKED (admin khoá qua trang quản lý)
    ========================================================= */
    if (customer.isLocked) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa",
      });
    }

    /* =========================================================
       SAVE CUSTOMER INFO
    ========================================================= */
    req.customer = {
      accountId: customer._id,
      phone: customer.phone,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = customerAuthMiddleware;
