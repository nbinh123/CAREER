const express = require('express');
const router = express.Router();
const specialMiddleware = require('../middleware/specialMiddleware');
const multer = require("multer");
const upload = multer({
    dest: "uploads/"
});
const {
    createImportTransaction,
    createExportTransaction,
    getTransactions,
    getTransactionById,
    softDeleteTransaction
} = require('../../controllers/IngredientTransactionController');

// Thay authMiddleware bằng middleware xác thực của dự án bạn
// const authMiddleware = require('../middlewares/authMiddleware');

// router.use(authMiddleware);

router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/import', specialMiddleware, upload.single("invoiceImage"), createImportTransaction);
router.post('/export', specialMiddleware, createExportTransaction);
router.delete('/:id', softDeleteTransaction);

module.exports = router;