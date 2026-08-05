const express = require("express")
const router = express.Router()

const FruitController = require("../../controllers/FruitController")

router.get("/search", FruitController.searchFruits) // đặt TRƯỚC "/:id", không thì "search" bị hiểu nhầm thành :id
router.get("/combo", FruitController.getComboFruits) // đặt TRƯỚC "/:id", không thì "combo" bị hiểu nhầm thành :id
router.get("/", FruitController.getAllFruits)
router.get("/:id", FruitController.getFruitById)

router.post("/", FruitController.createFruit)
router.put("/:id", FruitController.updateFruit)
router.delete("/:id", FruitController.deleteFruit)

module.exports = router
