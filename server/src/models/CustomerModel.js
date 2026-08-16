// models/CustomerModel.js
//
// Tài khoản KHÁCH HÀNG (app mobile) — tách biệt hoàn toàn với UserModel
// (UserModel chỉ dành cho nhân viên: có citizenId/CCCD, role admin/manager/...,
// không phù hợp với khách hàng). Xem mục 3.1 kế hoạch chuyển đổi React Native.
//
// ⚠️ Kênh web hiện tại KHÔNG dùng model này — web vẫn tiếp tục dùng
// customerId ẩn danh (UUID localStorage) như đang chạy, không đổi gì
// (xem OnlineOrderModel.js). Model này chỉ phục vụ tài khoản thật trên
// app mobile, bắt buộc đăng nhập bằng SĐT + mật khẩu 6 số.

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // dùng thống nhất 1 thư viện (bcryptjs) — xem ghi chú mục 6 kế hoạch

const Schema = mongoose.Schema;

const customerSchema = new Schema(
  {
    // Định danh đăng nhập chính
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Hash bcrypt, 6 số do khách tự đặt lúc đăng ký
    password: {
      type: String,
      required: true,
      select: false,
    },

    // Khách tự nhập lúc đăng ký hoặc lần đặt đầu tiên
    fullName: {
      type: String,
      trim: true,
      default: "",
    },

    // Tối thiểu 1 địa chỉ giao hàng mặc định — phần tử đầu tiên coi là
    // địa chỉ mặc định. Có thể rỗng ngay lúc đăng ký, điền sau qua
    // PATCH /me hoặc tự động điền lúc checkout đơn đầu tiên.
    addresses: {
      type: [String],
      default: [],
    },

    // Để sẵn cho OTP giai đoạn sau (mục 7 kế hoạch) — chưa dùng ở bản này
    phoneVerified: {
      type: Boolean,
      default: false,
    },

    // Admin khoá tài khoản qua trang quản lý (mục 4 kế hoạch)
    isLocked: {
      type: Boolean,
      default: false,
    },

    // Bật lên = true khi admin reset mật khẩu hộ khách — bắt khách đổi
    // mật khẩu ở lần đăng nhập kế tiếp (cùng pattern changeFirstPassword
    // đang có sẵn cho nhân viên)
    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    // Đếm số lần sai mật khẩu liên tiếp — reset về 0 mỗi lần đăng nhập
    // đúng. Dùng để khoá tạm, xem mục 3.6 kế hoạch.
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    // Khoá tạm sau nhiều lần sai liên tiếp (mục 3.6 + mục 8 kế hoạch).
    // null nghĩa là không đang bị khoá tạm.
    lockedUntil: {
      type: Date,
      default: null,
    },

    // Giống pattern đang dùng ở UserModel — hỗ trợ đăng nhập nhiều thiết bị
    refreshTokens: [
      {
        token: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Dùng để logout toàn bộ thiết bị (tăng lên 1 mỗi lần logout-all)
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // Phục vụ thống kê trên trang admin
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   HASH PASSWORD
========================================================= */
customerSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);

    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

/* =========================================================
   COMPARE PASSWORD
========================================================= */
customerSchema.methods.comparePassword = async function (
  candidatePassword
) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Customer", customerSchema);
