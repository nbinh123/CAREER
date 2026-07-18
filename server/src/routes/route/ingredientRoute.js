const express = require("express")
const router = express.Router()
// nạp file HomeController
const IngredientController = require("../../controllers/IngredientController")
const authMiddleware = require("../middleware/auth.middleware")

// router.get("/seed", IngredientController.seed);
router.get("/seedAllIngredient", IngredientController.seedAllIngredient)
router.get("/", IngredientController.getAll);
router.get("/:id", IngredientController.getOrderById);

router.post("/import", IngredientController.importIngredients);
router.post("/", IngredientController.create);

router.put("/:id", IngredientController.update);
router.delete("/:id", IngredientController.delete);


module.exports = router