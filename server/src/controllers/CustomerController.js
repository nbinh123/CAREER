// controllers/CustomerController.js
//
// API cho tài khoản KHÁCH HÀNG (app mobile) — SĐT + mật khẩu 6 số.
// Xem mục 3.3 kế hoạch chuyển đổi React Native. Hoàn toàn tách biệt với
// UserController (nhân viên) — không đụng gì tới UserModel/UserController.

const Customer = require("../models/CustomerModel");
const OnlineOrder = require("../models/OnlineOrderModel");
const mongoose = require("mongoose");
const {
    generateCustomerAccessToken,
    generateCustomerRefreshToken,
    verifyCustomerRefreshToken,
} = require("../utils/customerToken");

const PHONE_REGEX = /^[0-9]{9,11}$/; // SĐT VN, chấp nhận có/không số 0 đầu tuỳ định dạng lưu
const PASSWORD_REGEX = /^[0-9]{6}$/; // mật khẩu bắt buộc đúng 6 chữ số (mục 2 kế hoạch)

const MAX_FAILED_ATTEMPTS = 5; // mục 3.6 kế hoạch
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 phút

// Sinh mật khẩu tạm 6 số ngẫu nhiên — dùng cho admin reset-password (mục 4)
const generateTempPassword = () =>
    String(Math.floor(100000 + Math.random() * 900000));

// Loại bỏ field nhạy cảm trước khi trả về client
const toPublicCustomer = (customer) => ({
    _id: customer._id,
    phone: customer.phone,
    fullName: customer.fullName,
    addresses: customer.addresses,
    phoneVerified: customer.phoneVerified,
    isLocked: customer.isLocked,
    mustChangePassword: customer.mustChangePassword,
    lastLoginAt: customer.lastLoginAt,
    createdAt: customer.createdAt,
});

class CustomerController {

    /* =========================================================
       [POST] /api/customers/register
       Đăng ký: phone + password (6 số) + fullName
       Tự đăng nhập luôn sau khi đăng ký (trả token) để mobile vào thẳng app
    ========================================================= */
    register = async (req, res) => {
        try {

            const { phone, password, fullName } = req.body;
            console.log("register req.body", req.body);
            /* =========================================================
               VALIDATE
            ========================================================= */
            if (!phone || !password || !fullName) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập đầy đủ số điện thoại, mật khẩu và họ tên",
                });
            }

            if (!PHONE_REGEX.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "Số điện thoại không hợp lệ",
                });
            }

            if (!PASSWORD_REGEX.test(password)) {
                return res.status(400).json({
                    success: false,
                    message: "Mật khẩu phải gồm đúng 6 chữ số",
                });
            }

            /* =========================================================
               CHECK PHONE EXISTS
            ========================================================= */
            const existing = await Customer.findOne({ phone });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Số điện thoại đã được đăng ký",
                });
            }

            /* =========================================================
               CREATE CUSTOMER
            ========================================================= */
            const newCustomer = new Customer({
                phone,
                password,
                fullName: fullName.trim(),
            });

            /* =========================================================
               CREATE TOKEN (đăng ký xong vào thẳng app, không bắt login lại)
            ========================================================= */
            const accessToken = generateCustomerAccessToken(newCustomer);
            const refreshToken = generateCustomerRefreshToken(newCustomer);

            newCustomer.lastLoginAt = new Date();
            newCustomer.refreshTokens.push({ token: refreshToken });

            await newCustomer.save();

            /* =========================================================
               RESPONSE
            ========================================================= */
            return res.status(201).json({
                success: true,
                message: "Đăng ký thành công",

                accessToken,
                refreshToken,

                customer: toPublicCustomer(newCustomer),
            });

        } catch (error) {

            console.error("CUSTOMER REGISTER ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [POST] /api/customers/login
       Đăng nhập, trả access token + refresh token
    ========================================================= */
    login = async (req, res) => {
        try {

            const { phone, password } = req.body;

            /* =========================================================
               VALIDATE
            ========================================================= */
            if (!phone || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập số điện thoại và mật khẩu",
                });
            }

            /* =========================================================
               FIND CUSTOMER
            ========================================================= */
            const customer = await Customer.findOne({ phone }).select(
                "+password"
            );

            if (!customer) {
                return res.status(401).json({
                    success: false,
                    message: "Sai số điện thoại hoặc mật khẩu",
                });
            }

            /* =========================================================
               CHECK ADMIN LOCK
            ========================================================= */
            if (customer.isLocked) {
                return res.status(403).json({
                    success: false,
                    message: "Tài khoản đã bị khóa, vui lòng liên hệ hỗ trợ",
                });
            }

            /* =========================================================
               CHECK TEMP LOCK (sai mật khẩu nhiều lần — mục 3.6)
            ========================================================= */
            if (customer.lockedUntil && customer.lockedUntil > new Date()) {
                return res.status(423).json({
                    success: false,
                    message:
                        "Tài khoản tạm khóa do đăng nhập sai nhiều lần, vui lòng thử lại sau ít phút",
                });
            }

            /* =========================================================
               CHECK PASSWORD
            ========================================================= */
            const isMatch = await customer.comparePassword(password);

            if (!isMatch) {
                customer.failedLoginAttempts += 1;

                if (customer.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
                    customer.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
                    customer.failedLoginAttempts = 0;
                }

                await customer.save();

                return res.status(401).json({
                    success: false,
                    message: "Sai số điện thoại hoặc mật khẩu",
                });
            }

            /* =========================================================
               CREATE TOKEN
            ========================================================= */
            const accessToken = generateCustomerAccessToken(customer);
            const refreshToken = generateCustomerRefreshToken(customer);

            /* =========================================================
               UPDATE LOGIN STATE
            ========================================================= */
            customer.failedLoginAttempts = 0;
            customer.lockedUntil = null;
            customer.lastLoginAt = new Date();
            customer.refreshTokens.push({ token: refreshToken });

            await customer.save();

            /* =========================================================
               RESPONSE
            ========================================================= */
            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công",

                accessToken,
                refreshToken,
                mustChangePassword: customer.mustChangePassword,

                customer: toPublicCustomer(customer),
            });

        } catch (error) {

            console.error("CUSTOMER LOGIN ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [POST] /api/customers/refresh-token
       Cấp lại access token (giống cơ chế UserController hiện có)
    ========================================================= */
    refreshAccessToken = async (req, res) => {
        try {

            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    message: "Refresh token required",
                });
            }

            /* =========================================================
               VERIFY REFRESH TOKEN
            ========================================================= */
            const decoded = verifyCustomerRefreshToken(refreshToken);

            /* =========================================================
               FIND CUSTOMER
            ========================================================= */
            const customer = await Customer.findById(decoded.accountId);

            if (!customer) {
                return res.status(401).json({
                    success: false,
                    message: "Customer not found",
                });
            }

            if (customer.isLocked) {
                return res.status(403).json({
                    success: false,
                    message: "Tài khoản đã bị khóa",
                });
            }

            /* =========================================================
               CHECK TOKEN VERSION
            ========================================================= */
            if (decoded.tokenVersion !== customer.tokenVersion) {
                return res.status(401).json({
                    success: false,
                    message: "Token expired",
                });
            }

            /* =========================================================
               CHECK TOKEN EXISTS
            ========================================================= */
            const tokenExists = customer.refreshTokens.some(
                (item) => item.token === refreshToken
            );

            if (!tokenExists) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid refresh token",
                });
            }

            /* =========================================================
               CREATE NEW ACCESS TOKEN
            ========================================================= */
            const newAccessToken = generateCustomerAccessToken(customer);

            return res.status(200).json({
                success: true,
                accessToken: newAccessToken,
            });

        } catch (error) {

            return res.status(401).json({
                success: false,
                message: "Invalid refresh token",
            });

        }
    };

    /* =========================================================
       [POST] /api/customers/logout
       Đăng xuất thiết bị hiện tại (xoá 1 refreshToken)
    ========================================================= */
    logout = async (req, res) => {
        try {

            const accountId = req.customer.accountId;
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: "Thiếu refreshToken",
                });
            }

            const customer = await Customer.findById(accountId);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found",
                });
            }

            customer.refreshTokens = customer.refreshTokens.filter(
                (item) => item.token !== refreshToken
            );

            await customer.save();

            return res.status(200).json({
                success: true,
                message: "Đăng xuất thành công",
            });

        } catch (error) {

            console.error("CUSTOMER LOGOUT ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [POST] /api/customers/logout-all
       Đăng xuất toàn bộ thiết bị (tăng tokenVersion)
    ========================================================= */
    logoutAllDevices = async (req, res) => {
        try {

            const accountId = req.customer.accountId;

            const customer = await Customer.findById(accountId);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found",
                });
            }

            customer.refreshTokens = [];
            customer.tokenVersion += 1;

            await customer.save();

            return res.status(200).json({
                success: true,
                message: "Đăng xuất tất cả thiết bị thành công",
            });

        } catch (error) {

            console.error("CUSTOMER LOGOUT ALL ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [GET] /api/customers/me
       Lấy thông tin tài khoản đang đăng nhập
    ========================================================= */
    getMe = async (req, res) => {
        try {

            const customer = await Customer.findById(req.customer.accountId);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found",
                });
            }

            return res.status(200).json({
                success: true,
                customer: toPublicCustomer(customer),
            });

        } catch (error) {

            console.error("GET ME ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [PATCH] /api/customers/me
       Khách tự cập nhật tên / địa chỉ
    ========================================================= */
    updateMe = async (req, res) => {
        try {

            const { fullName, addresses } = req.body;

            const customer = await Customer.findById(req.customer.accountId);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found",
                });
            }

            if (typeof fullName === "string") {
                customer.fullName = fullName.trim();
            }

            if (Array.isArray(addresses)) {
                customer.addresses = addresses
                    .map((a) => (typeof a === "string" ? a.trim() : ""))
                    .filter(Boolean);
            }

            await customer.save();

            return res.status(200).json({
                success: true,
                message: "Cập nhật thành công",
                customer: toPublicCustomer(customer),
            });

        } catch (error) {

            console.error("UPDATE ME ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [PUT] /api/customers/me/password
       Đổi mật khẩu (khi biết mật khẩu cũ)
    ========================================================= */
    changePassword = async (req, res) => {
        try {

            const { currentPassword, newPassword, confirmPassword } = req.body;

            /* =========================================================
               VALIDATE
            ========================================================= */
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập đầy đủ thông tin",
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Xác nhận mật khẩu không khớp",
                });
            }

            if (!PASSWORD_REGEX.test(newPassword)) {
                return res.status(400).json({
                    success: false,
                    message: "Mật khẩu mới phải gồm đúng 6 chữ số",
                });
            }

            /* =========================================================
               FIND CUSTOMER
            ========================================================= */
            const customer = await Customer.findById(req.customer.accountId).select(
                "+password"
            );

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found",
                });
            }

            /* =========================================================
               CHECK CURRENT PASSWORD
            ========================================================= */
            const isMatch = await customer.comparePassword(currentPassword);

            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Mật khẩu hiện tại không đúng",
                });
            }

            /* =========================================================
               UPDATE PASSWORD
            ========================================================= */
            customer.password = newPassword;
            customer.mustChangePassword = false;

            await customer.save();

            return res.status(200).json({
                success: true,
                message: "Đổi mật khẩu thành công",
            });

        } catch (error) {

            console.error("CUSTOMER CHANGE PASSWORD ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [GET] /api/customers/me/orders
       Lịch sử đơn của tài khoản (theo accountId)

       ⚠️ Đơn từ mobile được ghi customerId = accountId dạng string (xem
       mục 3.2 kế hoạch + OnlineOrderModel.js) nên lọc thẳng theo customerId
       là đủ, không cần lọc theo accountId riêng.
    ========================================================= */
    getMyOrders = async (req, res) => {
        try {

            const accountId = String(req.customer.accountId);

            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
            const skip = (page - 1) * limit;

            const [orders, total] = await Promise.all([
                OnlineOrder.find({ customerId: accountId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                OnlineOrder.countDocuments({ customerId: accountId }),
            ]);

            return res.status(200).json({
                success: true,
                total,
                page,
                limit,
                orders,
            });

        } catch (error) {

            console.error("GET MY ORDERS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [GET] /api/customers  [Admin]
       Danh sách khách hàng, tìm theo SĐT/tên
    ========================================================= */
    adminGetCustomers = async (req, res) => {
        try {

            const { search, page = 1, limit = 20 } = req.query;

            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const skip = (pageNum - 1) * limitNum;

            const filter = {};

            if (search && search.trim()) {
                const keyword = search.trim();
                filter.$or = [
                    { phone: { $regex: keyword, $options: "i" } },
                    { fullName: { $regex: keyword, $options: "i" } },
                ];
            }

            const [customers, total] = await Promise.all([
                Customer.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum),
                Customer.countDocuments(filter),
            ]);

            return res.status(200).json({
                success: true,
                total,
                page: pageNum,
                limit: limitNum,
                customers: customers.map(toPublicCustomer),
            });

        } catch (error) {

            console.error("ADMIN GET CUSTOMERS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [PATCH] /api/customers/:id/lock  [Admin]
       Khoá tài khoản
    ========================================================= */
    adminLockCustomer = async (req, res) => {
        try {

            const { id } = req.params;

            const customer = await Customer.findById(id);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy khách hàng",
                });
            }

            customer.isLocked = true;

            await customer.save();

            return res.status(200).json({
                success: true,
                message: "Đã khoá tài khoản khách hàng",
                customer: toPublicCustomer(customer),
            });

        } catch (error) {

            console.error("ADMIN LOCK CUSTOMER ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [PATCH] /api/customers/:id/unlock  [Admin]
       Mở khoá tài khoản
    ========================================================= */
    adminUnlockCustomer = async (req, res) => {
        try {

            const { id } = req.params;

            const customer = await Customer.findById(id);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy khách hàng",
                });
            }

            customer.isLocked = false;
            // Mở khoá cũng nên gỡ luôn khoá tạm do sai mật khẩu (nếu có),
            // tránh khách vừa được admin mở khoá lại tiếp tục bị chặn.
            customer.lockedUntil = null;
            customer.failedLoginAttempts = 0;

            await customer.save();

            return res.status(200).json({
                success: true,
                message: "Đã mở khoá tài khoản khách hàng",
                customer: toPublicCustomer(customer),
            });

        } catch (error) {

            console.error("ADMIN UNLOCK CUSTOMER ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    /* =========================================================
       [POST] /api/customers/:id/reset-password  [Admin]
       Reset về mật khẩu tạm 6 số, bật mustChangePassword
    ========================================================= */
    adminResetPassword = async (req, res) => {
        try {

            const { id } = req.params;

            const customer = await Customer.findById(id);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy khách hàng",
                });
            }

            const tempPassword = generateTempPassword();

            customer.password = tempPassword;
            customer.mustChangePassword = true;

            // Reset mật khẩu cũng nên gỡ khoá tạm do sai mật khẩu (nếu có) —
            // khách cần đăng nhập lại được ngay bằng mật khẩu tạm admin vừa đọc.
            customer.lockedUntil = null;
            customer.failedLoginAttempts = 0;

            await customer.save();

            return res.status(200).json({
                success: true,
                message:
                    "Đã reset mật khẩu — đọc mật khẩu tạm bên dưới cho khách qua điện thoại/chat",
                tempPassword,
            });

        } catch (error) {

            console.error("ADMIN RESET PASSWORD ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    adminGetCustomerOrders = async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: "ID khách hàng không hợp lệ",
                });
            }

            const customer = await Customer.findById(id);
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy khách hàng",
                });
            }

            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const skip = (page - 1) * limit;

            // accountId: đơn đặt qua app mobile lúc đã đăng nhập (khớp chính xác)
            // phone: đơn đặt ẩn danh trên web bằng cùng số điện thoại
            const filter = {
                $or: [{ accountId: customer._id }, { phone: customer.phone }],
            };

            const [orders, total] = await Promise.all([
                OnlineOrder.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                OnlineOrder.countDocuments(filter),
            ]);

            return res.status(200).json({
                success: true,
                orders,
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            });
        } catch (error) {
            console.error("adminGetCustomerOrders error:", error);
            return res.status(500).json({
                success: false,
                message: "Lỗi server khi lấy lịch sử đơn hàng",
            });
        }
    };
}

module.exports = new CustomerController();
