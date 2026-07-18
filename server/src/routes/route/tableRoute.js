// routes/route/tableRoute.js
const express = require("express");
const router = express.Router();
const TableController = require("../../controllers/TableController");

router.get("/", TableController.getTables);
router.get("/:number", TableController.getTableByNumber);
router.post("/seed", TableController.seedTables);

module.exports = router;