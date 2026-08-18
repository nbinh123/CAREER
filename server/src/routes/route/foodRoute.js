const express = require("express")
const router = express.Router()
const FoodController = require("../../controllers/FoodController")
const authMiddleware = require("../middleware/auth.middleware")

// Multer đã được tạo sẵn bên trong FoodController.js (memoryStorage, đẩy
// buffer lên Cloudinary trong createFood/updateFood) — dùng lại chứ không
// tạo instance multer thứ 2.
const upload = FoodController.upload

// ── Route cụ thể (static path) LUÔN đặt trước route động /:id ──
router.get('/seedAllFood', authMiddleware, FoodController.seedAllFood)
router.get('/search', authMiddleware, FoodController.searchFoods)
router.patch('/refresh-cost', authMiddleware, FoodController.refreshFoodCosts)
router.post('/import', authMiddleware, FoodController.importFoods)

router.get('/', FoodController.getFoods)
// ❗ MỚI — upload.single('image') để req.file có giá trị trong createFood.
// Trước đây route này thiếu middleware này nên req.file luôn undefined.
router.post('/', upload.single('image'), authMiddleware, FoodController.createFood)

// ── Route động /:id đặt SAU CÙNG ──
router.get('/:id', authMiddleware, FoodController.getFoodById)
router.put('/:id', upload.single('image'), authMiddleware, FoodController.updateFood)
router.delete('/:id', authMiddleware, FoodController.deleteFood)
module.exports = router