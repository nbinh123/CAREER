const User = require("../models/UserModel")
const Food = require("../models/FoodModel")
const mongoose = require("mongoose")
const Ingredient = require("../models/IngredientModel")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

class IngredientController {
    seed = async (req, res) => {
        // // Xóa cũ nếu muốn
        // await Food.deleteMany();

        // Insert data
        const insertedIngredients =
            await Ingredient.insertMany(data);

        return res.status(201).json({
            message: "Seed ingredients successfully",
            count: insertedIngredients.length,
            data: insertedIngredients,
        });
        return res.status(200).json({ message: "Seed ingredients successfully" });

    }

    getOrderById = async (req, res) => {
        const { orderId } = req.params;

        const ingredient = await Ingredient.findById(orderId);

        if (!ingredient) {
            return res.status(404).json({ message: "Ingredient not found" });
        }
        return res.status(200).json(ingredient);
    }

    create = async (req, res) => {
        const {
            ingredientName,
            quantity,
            smallUnit,
            largeUnit,
            pricePerLargeUnit,
            expiryDays,
            displayOrder,
            note,
            needContinuousRestock
        } = req.body;

        const newIngredient = new Ingredient({
            ingredientName,
            quantity,
            smallUnit,
            largeUnit,
            pricePerLargeUnit,
            expiryDays,
            displayOrder,
            note,
            needContinuousRestock
        });

        const savedIngredient = await newIngredient.save();
        return res.status(201).json(savedIngredient);
    }

    update = async (req, res) => {
        const { id } = req.params;
        const {
            ingredientName,
            quantity,
            smallUnit,
            largeUnit,
            pricePerLargeUnit,
            expiryDays,
            displayOrder,
            note,
            needContinuousRestock
        } = req.body;

        const updatedIngredient = await Ingredient.findByIdAndUpdate(
            id,
            {
                ingredientName,
                quantity,
                smallUnit,
                largeUnit,
                pricePerLargeUnit,
                expiryDays,
                displayOrder,
                note,
                needContinuousRestock
            },
            { new: true }
        );

        if (!updatedIngredient) {
            return res.status(404).json({ message: "Ingredient not found" });
        }

        return res.status(200).json(updatedIngredient);
    }

    delete = async (req, res) => {
        const { id } = req.params;

        const deletedIngredient = await Ingredient.findByIdAndDelete(id);

        if (!deletedIngredient) {
            return res.status(404).json({ message: "Ingredient not found" });
        }

        return res.status(200).json({ message: "Ingredient deleted successfully" });
    }

    getAll = async (req, res) => {
        const ingredients = await Ingredient.find().sort({ displayOrder: 1 });
        return res.status(200).json(ingredients);
    }

    seedAllIngredient = async (req, res) => {
        try {
            const ingredients = [];

            // ── Validate input ─────────────────────────────────────────
            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Body phải là một mảng JSON và không được rỗng.",
                });
            }

            const results = {
                total: ingredients.length,
                created: 0,
                skipped: 0,
                failed: 0,
                skippedList: [],
                failedList: [],
            };

            // ── Xử lý từng ingredient ──────────────────────────────────
            for (const data of ingredients) {
                try {
                    // Kiểm tra trùng theo ingredientName
                    const existing = await Ingredient.findOne({
                        ingredientName: data.ingredientName?.trim(),
                    });

                    if (existing) {
                        results.skipped++;
                        results.skippedList.push({
                            ingredientName: data.ingredientName,
                            reason: "Đã tồn tại trong database",
                        });
                        continue;
                    }

                    const newIngredient = new Ingredient({
                        ingredientName: data.ingredientName,
                        displayOrder: data.displayOrder ?? 0,
                        quantity: data.quantity ?? 0,
                        stockQuantity: data.stockQuantity ?? 0,
                        smallUnit: data.smallUnit,
                        largeUnit: data.largeUnit,
                        pricePerLargeUnit: data.pricePerLargeUnit,
                        expiryDays: data.expiryDays,
                        note: data.note ?? "",
                        needContinuousRestock: data.needContinuousRestock ?? false,
                    });

                    await newIngredient.save();
                    results.created++;

                } catch (err) {
                    results.failed++;
                    results.failedList.push({
                        ingredientName: data.ingredientName,
                        error: err.message,
                    });
                }
            }

            // ── Trả về kết quả tổng hợp ────────────────────────────────
            return res.status(200).json({
                success: true,
                message: `Import hoàn tất: ${results.created} thành công, ${results.skipped} bỏ qua, ${results.failed} lỗi.`,
                results,
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi server khi import ingredients.",
                error: error.message,
            });
        }
    }

    importIngredients = async (req, res) => {
        try {
            const { ingredients } = req.body;

            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({
                    message: 'Dữ liệu import phải là một mảng và không được rỗng',
                });
            }

            const allowedFields = [
                'displayOrder', 'ingredientName', 'quantity', 'smallUnit',
                'largeUnit', 'pricePerLargeUnit', 'expiryDays', 'note',
                'needContinuousRestock', 'stockQuantity',
            ];

            const ops = ingredients.map((item) => {
                const doc = {};
                allowedFields.forEach((f) => {
                    if (item[f] !== undefined) doc[f] = item[f];
                });

                const hasValidId = item._id && mongoose.Types.ObjectId.isValid(item._id);

                // Có _id hợp lệ → update bản ghi cũ (hoặc tạo mới nếu id đó chưa tồn tại)
                if (hasValidId) {
                    return {
                        updateOne: {
                            filter: { _id: item._id },
                            update: { $set: doc },
                            upsert: true,
                        },
                    };
                }

                // Không có _id (hoặc _id không hợp lệ) → luôn tạo bản ghi mới
                return { insertOne: { document: doc } };
            });

            const result = await Ingredient.bulkWrite(ops, { ordered: false });

            return res.status(200).json({
                message: 'Import thành công',
                matched: result.matchedCount,
                modified: result.modifiedCount,
                upserted: result.upsertedCount,
                inserted: result.insertedCount,
            });
        } catch (error) {
            console.error('Import ingredients error:', error);
            return res.status(500).json({
                message: 'Lỗi khi import dữ liệu',
                error: error.message,
            });
        }
    };

}
module.exports = new IngredientController()