const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    username: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    // Đăng nhập bằng số điện thoại
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // CCCD
    citizenId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 12,
      maxlength: 12,
    },

    // Password mặc định = 6 số cuối CCCD
    password: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "manager", "cashier", "chef", "staff"],
      default: "staff",
      index: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    // Bắt buộc đổi mật khẩu sau lần đầu đăng nhập
    mustChangePassword: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
    refreshTokens: [
      {
        token: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    tokenVersion: {
      type: Number,
      default: 0,
    },

    // =========================================================
    // WORK & SALARY
    // =========================================================

    hourlySalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    unpaidWorkTime: {
      type: Number,
      default: 0,
      min: 0,
    },

    unpaidSalaryAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalWorkedTime: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   AUTO GENERATE PASSWORD + HASH PASSWORD
========================================================= */
userSchema.pre("save", async function (next) {
  try {
    // Nếu chưa có password
    // => dùng 6 số cuối CCCD
    if (!this.password && this.citizenId) {
      this.password = this.citizenId.slice(-6);
    }

    // Không hash lại nếu password không đổi
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
userSchema.methods.comparePassword = async function (
  candidatePassword
) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);