const express = require("express");

const router = express.Router();

/* =========================================================
   CONTROLLERS
========================================================= */
const UserController = require("../../controllers/UserController");

/* =========================================================
   MIDDLEWARES
========================================================= */
const specialMiddleware =
    require("../middleware/specialMiddleware");

const authorizeRoles =
    require("../middleware/authorizeRoles");

/* =========================================================
   AUTH
========================================================= */

// Login
router.post("/login",UserController.login);

// Refresh token
router.post("/refresh-token",UserController.refreshAccessToken);

// Logout all devices
router.post("/logout-all", specialMiddleware,UserController.logoutAllDevices);

// Change first password
router.put("/change-first-password", specialMiddleware,UserController.changeFirstPassword);

/* =========================================================
   USERS
========================================================= */

// Get all users
// router.get("/", specialMiddleware, authorizeRoles("admin", "manager"), UserController.getUsers);
router.get("/", UserController.getUsers)

// Create user
router.post("/register", specialMiddleware, authorizeRoles("admin"), UserController.createUser);

router.get("/seed", UserController.seedAdmin)

router.post("/:id/work-time", specialMiddleware, UserController.updateWorkTime)

router.post("/:id/salary", specialMiddleware, UserController.paySalary)


////////////////////////////////////////////// IMPORT VÀ EXPORT

router.get("/seedAdmin", UserController.seedAdmin)
router.get("/seedAllUsers", UserController.seedAllUsers)


module.exports = router;