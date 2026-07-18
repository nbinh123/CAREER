const User = require("../models/UserModel");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');

class UserController {
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
               FIND USER
            ========================================================= */
            const user = await User.findOne({
                phone,
                isDeleted: false,
            }).select("+password");

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Sai số điện thoại hoặc mật khẩu",
                });
            }

            /* =========================================================
               CHECK ACTIVE
            ========================================================= */
            if (!user.isActive) {
                return res.status(403).json({
                    success: false,
                    message: "Tài khoản đã bị khóa",
                });
            }

            /* =========================================================
               CHECK PASSWORD
            ========================================================= */
            const isMatch = await user.comparePassword(password);

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Sai số điện thoại hoặc mật khẩu",
                });
            }
            /* =========================================================
                CREATE TOKEN
             ========================================================= */
            const token = jwt.sign(
                {
                    userId: user._id,
                    role: user.role,
                    tokenVersion: user.tokenVersion,
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1d",
                }
            );

            const refreshToken = jwt.sign(
                {
                    userId: user._id,
                    tokenVersion: user.tokenVersion,
                },
                process.env.JWT_REFRESH_SECRET,
                {
                    expiresIn: "30d",
                }
            );

            /* =========================================================
               UPDATE LAST LOGIN
            ========================================================= */
            user.lastLogin = new Date();

            user.refreshTokens.push({
                token: refreshToken,
            });

            await user.save();


            /* =========================================================
               RESPONSE
            ========================================================= */
            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công",

                token,
                refreshToken,
                mustChangePassword: user.mustChangePassword,

                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    username: user.username,
                    phone: user.phone,
                    role: user.role,
                    avatar: user.avatar,
                },
            });
        } catch (error) {
            console.error("LOGIN ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });
        }
    };

    createUser = async (req, res) => {
        try {

            const {
                fullName,
                username,
                phone,
                citizenId,
                role,
                avatar,
            } = req.body;

            /* =========================================================
               VALIDATE
            ========================================================= */
            if (!fullName || !phone || !citizenId) {
                return res.status(400).json({
                    success: false,
                    message: "Thiếu thông tin bắt buộc",
                });
            }

            /* =========================================================
               VALIDATE ROLE
            ========================================================= */
            const validRoles = [
                "admin",
                "manager",
                "cashier",
                "chef",
                "staff",
            ];

            if (role && !validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: "Role không hợp lệ",
                });
            }

            /* =========================================================
               CHECK PHONE EXISTS
            ========================================================= */
            const existingPhone = await User.findOne({
                phone,
                isDeleted: false,
            });

            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: "Số điện thoại đã tồn tại",
                });
            }

            /* =========================================================
               CHECK CCCD EXISTS
            ========================================================= */
            const existingCitizenId = await User.findOne({
                citizenId,
                isDeleted: false,
            });

            if (existingCitizenId) {
                return res.status(400).json({
                    success: false,
                    message: "CCCD đã tồn tại",
                });
            }

            /* =========================================================
               CHECK USERNAME EXISTS
            ========================================================= */
            if (username) {

                const existingUsername = await User.findOne({
                    username,
                    isDeleted: false,
                });

                if (existingUsername) {
                    return res.status(400).json({
                        success: false,
                        message: "Username đã tồn tại",
                    });
                }

            }

            /* =========================================================
               CREATE USER
               Password = 6 số cuối CCCD
            ========================================================= */
            const newUser = new User({
                fullName,
                username,
                phone,
                citizenId,
                role: role || "staff",
                avatar,
            });

            await newUser.save();

            /* =========================================================
               RESPONSE
            ========================================================= */
            return res.status(201).json({
                success: true,
                message: "Tạo tài khoản thành công",

                defaultPassword: citizenId.slice(-6),

                user: {
                    _id: newUser._id,
                    fullName: newUser.fullName,
                    username: newUser.username,
                    phone: newUser.phone,
                    citizenId: newUser.citizenId,
                    role: newUser.role,
                    avatar: newUser.avatar,
                    mustChangePassword:
                        newUser.mustChangePassword,
                },
            });

        } catch (error) {

            console.error("CREATE USER ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    changeFirstPassword = async (req, res) => {
        try {

            const userId = req.user.userId;

            const {
                currentPassword,
                newPassword,
                confirmPassword,
            } = req.body;

            /* =========================================================
               VALIDATE
            ========================================================= */
            if (
                !currentPassword ||
                !newPassword ||
                !confirmPassword
            ) {
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

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Mật khẩu phải từ 6 ký tự",
                });
            }

            /* =========================================================
               FIND USER
            ========================================================= */
            const user = await User.findById(userId)
                .select("+password");

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User không tồn tại",
                });
            }

            /* =========================================================
               CHECK CURRENT PASSWORD
            ========================================================= */
            const isMatch =
                await user.comparePassword(currentPassword);

            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Mật khẩu hiện tại không đúng",
                });
            }

            /* =========================================================
               UPDATE PASSWORD
            ========================================================= */
            user.password = newPassword;

            user.mustChangePassword = false;

            await user.save();

            return res.status(200).json({
                success: true,
                message: "Đổi mật khẩu thành công",
            });

        } catch (error) {

            console.error("CHANGE PASSWORD ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    getUsers = async (req, res) => {
        try {

            const users = await User.find({
                isDeleted: false,
            })
                .select("-password -refreshTokens")
                .sort({ createdAt: -1 });

            return res.status(200).json({
                success: true,
                total: users.length,
                users,
            });

        } catch (error) {

            console.error("GET USERS ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

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
            const decoded = jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET
            );

            /* =========================================================
               FIND USER
            ========================================================= */
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User not found",
                });
            }

            /* =========================================================
               CHECK TOKEN VERSION
            ========================================================= */
            if (
                decoded.tokenVersion !==
                user.tokenVersion
            ) {
                return res.status(401).json({
                    success: false,
                    message: "Token expired",
                });
            }

            /* =========================================================
               CHECK TOKEN EXISTS
            ========================================================= */
            const tokenExists =
                user.refreshTokens.some(
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
            const newAccessToken = jwt.sign(
                {
                    userId: user._id,
                    role: user.role,
                    tokenVersion: user.tokenVersion,
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1d",
                }
            );

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
    }

    logoutAllDevices = async (req, res) => {
        try {

            const userId = req.user.userId;

            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            /* =========================================================
               REMOVE ALL TOKENS
            ========================================================= */
            user.refreshTokens = [];

            /* =========================================================
               INVALIDATE OLD ACCESS TOKENS
            ========================================================= */
            user.tokenVersion += 1;

            await user.save();

            return res.status(200).json({
                success: true,
                message: "Đăng xuất tất cả thiết bị thành công",
            });

        } catch (error) {

            console.error("LOGOUT ALL ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Lỗi server",
            });

        }
    };

    updateWorkTime = async (req, res) => {
        try {
            const { id } = req.params;

            // số giờ làm thêm
            const { workHour } = req.body;

            if (!workHour || workHour <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "workHour không hợp lệ",
                });
            }

            const user = await User.findById(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy nhân viên",
                });
            }

            // cộng thời gian làm
            user.unpaidWorkTime += workHour;
            user.totalWorkedTime += workHour;

            // cộng tiền lương
            const salaryToAdd =
                (workHour) * user.hourlySalary;

            user.unpaidSalaryAmount += salaryToAdd;

            await user.save();

            return res.status(200).json({
                success: true,
                message: "Cập nhật giờ làm thành công",
                data: {
                    unpaidWorkTime: user.unpaidWorkTime,
                    unpaidSalaryAmount:
                        user.unpaidSalaryAmount,
                },
            });
        } catch (error) {
            console.log(error);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    };

    paySalary = async (req, res) => {
        try {
            const { id } = req.params;

            const user = await User.findById(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy nhân viên",
                });
            }

            // Lưu lại dữ liệu trước khi reset
            const paidData = {
                totalMinutes: user.unpaidWorkTime,
                totalSalary: user.unpaidSalaryAmount,
            };

            // Reset
            user.unpaidWorkTime = 0;
            user.unpaidSalaryAmount = 0;

            await user.save();

            return res.status(200).json({
                success: true,
                message: "Thanh toán lương thành công",
                data: paidData,
            });
        } catch (error) {
            console.log(error);

            return res.status(500).json({
                success: false,
                message: "Server error",
            });
        }
    };

    seedAdmin = async (req, res) => {
        try {
            // Kiểm tra đã tồn tại chưa
            const existing = await User.findOne({
                $or: [
                    { username: "nvnb" },
                    { phone: "0905897713" },
                    { citizenId: "048206008619" },
                ],
            });

            if (existing) {
                return res.status(200).json({
                    success: false,
                    message: "Admin đã tồn tại, không cần seed lại.",
                    data: {
                        _id: existing._id,
                        fullName: existing.fullName,
                        username: existing.username,
                        role: existing.role,
                    },
                });
            }

            // Tạo admin mới
            const admin = new User({
                fullName: "Nguyen Van Nguyen Binh",
                username: "nvnb",
                phone: "0905897713",
                citizenId: "048206008619",
                role: "admin",
                avatar: "",
                mustChangePassword: true,
                isActive: true,
                isDeleted: false,
                hourlySalary: 0,
                totalWorkedTime: 0,
                unpaidSalaryAmount: 0,
                unpaidWorkTime: 0,
                // password sẽ tự động = 6 số cuối CCCD ("008619")
                // và được hash bởi pre-save hook
            });

            await admin.save();

            return res.status(201).json({
                success: true,
                message: "Seed admin thành công!",
                data: {
                    _id: admin._id,
                    fullName: admin.fullName,
                    username: admin.username,
                    phone: admin.phone,
                    citizenId: admin.citizenId,
                    role: admin.role,
                    defaultPassword: admin.citizenId.slice(-6), // "008619"
                    mustChangePassword: admin.mustChangePassword,
                },
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi khi seed admin.",
                error: error.message,
            });
        }
    };

    seedAllUsers = async (req, res) => {
        try {
            const users = [
                {
                    "_id": "6a171934f361990bb3c6dc82",
                    "fullName": "Do thi Tuong Vy",
                    "username": "dttv",
                    "phone": "0905897714",
                    "citizenId": "048206008620",
                    "role": "manager",
                    "avatar": "",
                    "mustChangePassword": true,
                    "isActive": true,
                    "isDeleted": false,
                    "lastLogin": "2026-05-30T03:19:18.906Z",
                    "tokenVersion": 0,
                    "createdAt": "2026-05-27T16:17:56.352Z",
                    "updatedAt": "2026-05-30T03:19:18.910Z",
                    "__v": 4,
                    "hourlySalary": 0,
                    "totalWorkedTime": 0,
                    "unpaidSalaryAmount": 0,
                    "unpaidWorkTime": 0
                },
                {
                    "_id": "6a171934f361990bb3c6dc81",
                    "fullName": "Song Hy Lam Mon",
                    "username": "shlm",
                    "phone": "0905897715",
                    "citizenId": "048206008621",
                    "role": "manager",
                    "avatar": "",
                    "mustChangePassword": true,
                    "isActive": true,
                    "isDeleted": false,
                    "lastLogin": "2026-05-30T03:19:18.906Z",
                    "tokenVersion": 0,
                    "createdAt": "2026-05-27T16:17:56.352Z",
                    "updatedAt": "2026-05-30T03:19:18.910Z",
                    "__v": 4,
                    "hourlySalary": 0,
                    "totalWorkedTime": 0,
                    "unpaidSalaryAmount": 0,
                    "unpaidWorkTime": 0
                }
            ]; // array JSON

            // ── Validate input ──────────────────────────────────────────
            if (!Array.isArray(users) || users.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Body phải là một mảng JSON và không được rỗng.",
                });
            }

            const results = {
                total: users.length,
                created: 0,
                skipped: 0,
                failed: 0,
                skippedList: [],  // các user đã tồn tại
                failedList: [],   // các user lỗi
            };

            // ── Xử lý từng user ─────────────────────────────────────────
            for (const userData of users) {
                try {
                    // Kiểm tra trùng lặp theo phone / citizenId / username
                    const filter = [
                        userData.phone && { phone: userData.phone },
                        userData.citizenId && { citizenId: userData.citizenId },
                        userData.username && { username: userData.username },
                    ].filter(Boolean);

                    const existing = filter.length
                        ? await User.findOne({ $or: filter })
                        : null;

                    if (existing) {
                        results.skipped++;
                        results.skippedList.push({
                            fullName: userData.fullName,
                            phone: userData.phone,
                            reason: "Đã tồn tại trong database",
                        });
                        continue;
                    }

                    // Tạo user mới — pre-save hook tự hash password
                    const newUser = new User({
                        fullName: userData.fullName,
                        username: userData.username,
                        phone: userData.phone,
                        citizenId: userData.citizenId,
                        role: userData.role ?? "staff",
                        avatar: userData.avatar ?? "",
                        mustChangePassword: userData.mustChangePassword ?? true,
                        isActive: userData.isActive ?? true,
                        isDeleted: userData.isDeleted ?? false,
                        hourlySalary: userData.hourlySalary ?? 0,
                        totalWorkedTime: userData.totalWorkedTime ?? 0,
                        unpaidSalaryAmount: userData.unpaidSalaryAmount ?? 0,
                        unpaidWorkTime: userData.unpaidWorkTime ?? 0,
                        // Nếu JSON có sẵn password plaintext thì truyền vào,
                        // hook sẽ hash lại. Nếu không có thì hook dùng 6 số cuối CCCD.
                        ...(userData.password && { password: userData.password }),
                    });

                    await newUser.save();
                    results.created++;

                } catch (err) {
                    results.failed++;
                    results.failedList.push({
                        fullName: userData.fullName,
                        phone: userData.phone,
                        error: err.message,
                    });
                }
            }

            // ── Trả về kết quả tổng hợp ──────────────────────────────────
            return res.status(200).json({
                success: true,
                message: `Import hoàn tất: ${results.created} thành công, ${results.skipped} bỏ qua, ${results.failed} lỗi.`,
                results,
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi server khi import users.",
                error: error.message,
            });
        }
    }
}
module.exports = new UserController;