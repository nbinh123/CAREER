// routes/AnalystControllerRoutes.js

const express = require('express');
const router = express.Router();
const AnalystController = require('../../controllers/AnalystController');

//
router.get("/stats", AnalystController.getStats);
router.get("/chart-data", AnalystController.getChartData);
router.get("/range", AnalystController.getRangeData);
router.get("/cumulative", AnalystController.getCumulative);
router.get("/top-dishes", AnalystController.getTopDishes);
router.get("/heatmap", AnalystController.getHeatmap);
router.get("/pid", AnalystController.getPidData);
router.get("/weekly", AnalystController.getWeeklySummary)
router.get("/week-revenue", AnalystController.getLast7DaysRevenue);

// test
router.get("/food-weights", AnalystController.updateFoodWeights);
router.get("/margin", AnalystController.getMarginAnalytics);
router.get("/avg-bill-value", AnalystController.getAvgBillValue);
// có thể mở lại khi cần
router.get('/monthly-summary', AnalystController.getMonthlySummary);
router.patch("/pid/:ingredientId", AnalystController.updatePidParams);

module.exports = router;