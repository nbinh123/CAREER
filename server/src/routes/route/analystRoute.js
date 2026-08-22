// routes/AnalystControllerRoutes.js

const express = require('express');
const router = express.Router();
const AnalystController = require('../../controllers/AnalystController');
const authMiddleware = require('../middleware/auth.middleware');

//
router.get("/stats", authMiddleware, AnalystController.getStats);
router.get("/chart-data", authMiddleware, AnalystController.getChartData);
router.get("/range", authMiddleware, AnalystController.getRangeData);
router.get("/cumulative", authMiddleware, AnalystController.getCumulative);
router.get("/top-dishes", authMiddleware, AnalystController.getTopDishes);
router.get("/heatmap", authMiddleware, AnalystController.getHeatmap);
router.get("/pid", authMiddleware, AnalystController.getPidData);
router.get("/weekly", authMiddleware, AnalystController.getWeeklySummary);
router.get("/week-revenue", authMiddleware, AnalystController.getLast7DaysRevenue);
router.get("/food-weights", authMiddleware, AnalystController.updateFoodWeights);
router.get("/margin", authMiddleware, AnalystController.getMarginAnalytics);
router.get("/avg-bill-value", authMiddleware, AnalystController.getAvgBillValue);
// có thể mở lại khi cần
router.get('/monthly-summary', authMiddleware, AnalystController.getMonthlySummary);
router.patch("/pid/:ingredientId", AnalystController.updatePidParams);

module.exports = router;