const jwt = require("jsonwebtoken");

const   authMiddleware = (req, res, next) => {
    try {
        // Lấy header Authorization
        const authHeader = req.headers.authorization;

        // Kiểm tra có header không
        if (!authHeader) {
            return res.status(401).json({
                message: "Access denied. No token provided",
                status: 401
            });
        }

        // Format: Bearer token
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Access denied. Invalid token format",
                status: 401
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Lưu thông tin user vào request để dùng tiếp
        req.user = decoded; // { id: user._id }

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token",
            status: 401
        });
    }
};

module.exports = authMiddleware;
