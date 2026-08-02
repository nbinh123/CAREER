const express = require("express")
const router = express.Router()
const FoodController = require("../../controllers/FoodController")
const authMiddleware = require("../middleware/auth.middleware")

// Multer đã được tạo sẵn bên trong FoodController.js (memoryStorage, đẩy
// buffer lên Cloudinary trong createFood/updateFood) — dùng lại chứ không
// tạo instance multer thứ 2.
const upload = FoodController.upload

// ── Route cụ thể (static path) LUÔN đặt trước route động /:id ──
router.get('/seedAllFood', FoodController.seedAllFood)
router.get('/search', FoodController.searchFoods)
router.patch('/refresh-cost', FoodController.refreshFoodCosts)
router.post('/import', FoodController.importFoods)

router.get('/', FoodController.getFoods)
// ❗ MỚI — upload.single('image') để req.file có giá trị trong createFood.
// Trước đây route này thiếu middleware này nên req.file luôn undefined.
router.post('/', upload.single('image'), FoodController.createFood)

// ── Route động /:id đặt SAU CÙNG ──
router.get('/:id', FoodController.getFoodById)
router.put('/:id', upload.single('image'), FoodController.updateFood)
router.delete('/:id', FoodController.deleteFood)
module.exports = router