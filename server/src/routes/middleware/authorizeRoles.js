// middlewares/authorizeRoles.js

const authorizeRoles = (...roles) => {

    return (req, res, next) => {

        try {

            // Kiểm tra đã login chưa
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized",
                });
            }

            // Kiểm tra role có hợp lệ không
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Bạn không có quyền truy cập",
                });
            }

            next();

        } catch (error) {

            return res.status(500).json({
                success: false,
                message: "Authorization error",
            });

        }

    };

};

module.exports = authorizeRoles;