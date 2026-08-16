// utils/customerToken.js
//
// Sinh & verify JWT riêng cho tài khoản KHÁCH HÀNG (app mobile) — tách biệt
// hoàn toàn với JWT của nhân viên (UserController dùng process.env.JWT_SECRET
// / JWT_REFRESH_SECRET, không có claim "type"). Xem mục 3.4 kế hoạch.
//
// Cách tách: dùng SECRET RIÊNG (JWT_CUSTOMER_SECRET / JWT_CUSTOMER_REFRESH_SECRET)
// + THÊM claim `type: "customer"` và kiểm tra lại claim này khi verify — làm cả
// 2 lớp (không chỉ 1) để token khách chắc chắn không thể lọt qua authorizeRoles
// của route quản trị, và token nhân viên cũng không verify được ở đây.
//
// ⚠️ CẦN THÊM 2 BIẾN MÔI TRƯỜNG MỚI vào .env production trước khi deploy:
//    JWT_CUSTOMER_SECRET=...
//    JWT_CUSTOMER_REFRESH_SECRET=...
// (Giá trị nên là chuỗi random dài, KHÁC với JWT_SECRET/JWT_REFRESH_SECRET
// hiện có của nhân viên.)

const jwt = require("jsonwebtoken");

const CUSTOMER_ACCESS_EXPIRES = "1d"; // giống thời hạn access token nhân viên (UserController)
const CUSTOMER_REFRESH_EXPIRES = "30d"; // giống thời hạn refresh token nhân viên (UserController)

/* =========================================================
   GENERATE ACCESS TOKEN
========================================================= */
const generateCustomerAccessToken = (customer) => {
  return jwt.sign(
    {
      type: "customer",
      accountId: customer._id,
      tokenVersion: customer.tokenVersion,
    },
    process.env.JWT_CUSTOMER_SECRET,
    {
      expiresIn: CUSTOMER_ACCESS_EXPIRES,
    }
  );
};

/* =========================================================
   GENERATE REFRESH TOKEN
========================================================= */
const generateCustomerRefreshToken = (customer) => {
  return jwt.sign(
    {
      type: "customer",
      accountId: customer._id,
      tokenVersion: customer.tokenVersion,
    },
    process.env.JWT_CUSTOMER_REFRESH_SECRET,
    {
      expiresIn: CUSTOMER_REFRESH_EXPIRES,
    }
  );
};

/* =========================================================
   VERIFY ACCESS TOKEN
========================================================= */
const verifyCustomerAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_CUSTOMER_SECRET);

  if (decoded.type !== "customer") {
    throw new Error("Token không phải của tài khoản khách hàng");
  }

  return decoded;
};

/* =========================================================
   VERIFY REFRESH TOKEN
========================================================= */
const verifyCustomerRefreshToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_CUSTOMER_REFRESH_SECRET);

  if (decoded.type !== "customer") {
    throw new Error("Token không phải của tài khoản khách hàng");
  }

  return decoded;
};

module.exports = {
  generateCustomerAccessToken,
  generateCustomerRefreshToken,
  verifyCustomerAccessToken,
  verifyCustomerRefreshToken,
};
