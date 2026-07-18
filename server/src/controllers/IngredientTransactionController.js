const mongoose = require('mongoose');
const IngredientTransaction = require('../models/IngredientTransaction');
const Ingredient = require('../models/IngredientModel');

const createImportTransaction = async (req, res) => {
    // const session = await mongoose.startSession();
    // session.startTransaction();
    try {
        const { ingredientId, quantity, amount, invoiceImage, note } = req.body;
        const createdBy = req.user.userId;

        if (!ingredientId || !quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'ingredientId và quantity (> 0) là bắt buộc',
                data: {}
            });
        }

        // const ingredient = await Ingredient.findById(ingredientId).session(session);
        const ingredient = await Ingredient.findById(ingredientId)
        if (!ingredient) {
            // await session.abortTransaction();
            // session.endSession();
            return res.status(404).json({ success: false, message: 'Nguyên liệu không tồn tại', data: {} });
        }

        const stockBefore = ingredient.quantity;
        const stockAfter = stockBefore + quantity;

        ingredient.quantity = stockAfter;
        // await ingredient.save({ session });
        await ingredient.save({});

        const [transaction] = await IngredientTransaction.create(
            [{ ingredientId, type: 'IMPORT', quantity, stockBefore, stockAfter, amount: amount || 0, invoiceImage, note, createdBy }],
            // { session }
            {}
        );

        // await session.commitTransaction();
        // session.endSession();

        const populated = await transaction.populate([
            { path: 'ingredientId', select: 'ingredientName smallUnit largeUnit pricePerLargeUnit' },
            { path: 'createdBy', select: 'name email' }
        ]);

        return res.status(201).json({ success: true, message: 'Nhập kho thành công', data: populated });
    } catch (error) {
        // await session.abortTransaction();
        // session.endSession();
        return res.status(500).json({ success: false, message: error.message, data: {} });
    }
};

const createExportTransaction = async (req, res) => {
    // const session = await mongoose.startSession();
    // session.startTransaction();
    try {
        const { ingredientId, quantity, note } = req.body;
        const createdBy = req.user.userId;

        if (!ingredientId || !quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'ingredientId và quantity (> 0) là bắt buộc',
                data: {}
            });
        }

        if (!note || !note.trim()) {
            return res.status(400).json({ success: false, message: 'Lý do xuất kho là bắt buộc', data: {} });
        }

        // const ingredient = await Ingredient.findById(ingredientId).session(session);
        const ingredient = await Ingredient.findById(ingredientId)
        if (!ingredient) {
            // await session.abortTransaction();
            // session.endSession();
            return res.status(404).json({ success: false, message: 'Nguyên liệu không tồn tại', data: {} });
        }

        if (ingredient.quantity < quantity) {
            // await session.abortTransaction();
            // session.endSession();
            return res.status(400).json({
                success: false,
                message: `Tồn kho không đủ. Hiện có: ${ingredient.quantity} ${ingredient.smallUnit}`,
                data: {}
            });
        }

        const stockBefore = ingredient.quantity;
        const stockAfter = stockBefore - quantity;

        ingredient.quantity = stockAfter;
        // await ingredient.save({ session });
        await ingredient.save({});

        const [transaction] = await IngredientTransaction.create(
            [{ ingredientId, type: 'EXPORT', quantity, stockBefore, stockAfter, amount: 0, note, createdBy }],
            // { session }
            {}
        );

        // await session.commitTransaction();
        // session.endSession();

        const populated = await transaction.populate([
            { path: 'ingredientId', select: 'ingredientName smallUnit largeUnit pricePerLargeUnit' },
            { path: 'createdBy', select: 'name email' }
        ]);

        return res.status(201).json({ success: true, message: 'Xuất kho thành công', data: populated });
    } catch (error) {
        // await session.abortTransaction();
        // session.endSession();
        return res.status(500).json({ success: false, message: error.message, data: {} });
    }
};

const getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, type, fromDate, toDate } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        let ingredientFilter = {};
        if (search && search.trim()) {
            const matchedIngredients = await Ingredient.find(
                { ingredientName: { $regex: search.trim(), $options: 'i' } },
                '_id'
            );
            ingredientFilter.ingredientId = { $in: matchedIngredients.map((i) => i._id) };
        }

        const filter = { isDeleted: { $ne: true }, ...ingredientFilter };

        if (type && ['IMPORT', 'EXPORT'].includes(type)) filter.type = type;

        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        const [transactions, total] = await Promise.all([
            IngredientTransaction.find(filter)
                .populate('ingredientId', 'ingredientName smallUnit largeUnit pricePerLargeUnit')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            IngredientTransaction.countDocuments(filter)
        ]);

        const [importStats, exportStats] = await Promise.all([
            IngredientTransaction.aggregate([
                { $match: { isDeleted: { $ne: true }, type: 'IMPORT' } },
                { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
            ]),
            IngredientTransaction.aggregate([
                { $match: { isDeleted: { $ne: true }, type: 'EXPORT' } },
                { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
            ])
        ]);

        return res.json({
            success: true,
            message: 'Lấy danh sách giao dịch thành công',
            data: {
                transactions,
                pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
                stats: {
                    importCount: importStats[0]?.count || 0,
                    importTotal: importStats[0]?.totalAmount || 0,
                    exportCount: exportStats[0]?.count || 0,
                    exportTotal: exportStats[0]?.totalAmount || 0
                }
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message, data: {} });
    }
};

const getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ', data: {} });
        }

        const transaction = await IngredientTransaction.findOne({ _id: id, isDeleted: { $ne: true } })
            .populate('ingredientId', 'ingredientName smallUnit largeUnit pricePerLargeUnit')
            .populate('createdBy', 'name email');

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại', data: {} });
        }

        return res.json({ success: true, message: 'Lấy chi tiết giao dịch thành công', data: transaction });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message, data: {} });
    }
};

const softDeleteTransaction = async (req, res) => {
    // const session = await mongoose.startSession();
    // session.startTransaction();
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID không hợp lệ', data: {} });
        }

        // const transaction = await IngredientTransaction.findOne({ _id: id, isDeleted: { $ne: true } }).session(session);
        const transaction = await IngredientTransaction.findOne({ _id: id, isDeleted: { $ne: true } })
        if (!transaction) {
            // await session.abortTransaction();
            // session.endSession();
            return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại', data: {} });
        }

        // const ingredient = await Ingredient.findById(transaction.ingredientId).session(session);
        const ingredient = await Ingredient.findById(transaction.ingredientId)
        if (ingredient) {
            if (transaction.type === 'IMPORT') {
                if (ingredient.quantity < transaction.quantity) {
                    // await session.abortTransaction();
                    // session.endSession();
                    return res.status(400).json({
                        success: false,
                        message: 'Không thể xóa: tồn kho hiện tại không đủ để hoàn tác giao dịch nhập này',
                        data: {}
                    });
                }
                ingredient.quantity -= transaction.quantity;
            } else {
                ingredient.quantity += transaction.quantity;
            }
            // await ingredient.save({ session });
            await ingredient.save({});
        }

        transaction.isDeleted = true;
        await transaction.save({ session });

        // await session.commitTransaction();
        // session.endSession();

        return res.json({ success: true, message: 'Xóa giao dịch thành công', data: {} });
    } catch (error) {
        // await session.abortTransaction();
        // session.endSession();
        return res.status(500).json({ success: false, message: error.message, data: {} });
    }
};

module.exports = {
    createImportTransaction,
    createExportTransaction,
    getTransactions,
    getTransactionById,
    softDeleteTransaction
};