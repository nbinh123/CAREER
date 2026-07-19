const express = require("express")
const router = express.Router()
const FoodController = require("../../controllers/FoodController")
const authMiddleware = require("../middleware/auth.middleware")

// ── Route cụ thể (static path) LUÔN đặt trước route động /:id ──
router.get('/seedAllFood', FoodController.seedAllFood)
router.get('/search', FoodController.searchFoods)
router.patch('/refresh-cost', FoodController.refreshFoodCosts)
router.post('/import', FoodController.importFoods)

router.get('/', FoodController.getFoods)
router.post('/', FoodController.createFood)

// ── Route động /:id đặt SAU CÙNG ──
router.get('/:id', FoodController.getFoodById)
router.put('/:id', FoodController.updateFood)
router.delete('/:id', FoodController.deleteFood)
module.exports = router