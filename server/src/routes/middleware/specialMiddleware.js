const jwt = require("jsonwebtoken");
const User = require("../../models/UserModel");

const specialMiddleware = async (req, res, next) => {

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

    /* =========================================================
       CHECK FORMAT
    ========================================================= */
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
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
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
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    /* =========================================================
       CHECK ACCOUNT STATUS
    ========================================================= */
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa",
      });
    }

    if (user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản không tồn tại",
      });
    }

    /* =========================================================
       SAVE USER INFO
    ========================================================= */
    req.user = {
      userId: user._id,
      role: user.role,
    };

    next();

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });

  }

};

module.exports = specialMiddleware;