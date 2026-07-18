const express = require("express")
const router = express.Router()
// nạp file HomeController
const FoodController = require("../../controllers/FoodController")
const authMiddleware = require("../middleware/auth.middleware")


router.get('/seedAllFood', FoodController.seedAllFood)
// router.get('/seed', FoodController.seed)

router.get('/', FoodController.getFoods)
router.post('/', FoodController.createFood)
router.get('/:id', FoodController.getFoodById)
router.put('/:id', FoodController.updateFood)
router.delete('/:id', FoodController.deleteFood)
router.get('/search', FoodController.searchFoods)
router.patch('/refresh-cost', FoodController.refreshFoodCosts)
router.post('/import', FoodController.importFoods)


module.exports = router