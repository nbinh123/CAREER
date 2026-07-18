// controllers/FoodController.js
const Food = require("../models/FoodModel");
const Ingredient = require("../models/IngredientModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { emitSafe } = require("../utils/emitSafe"); // ❗ MỚI — thay cho req.io?.emit

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "uploads/foods";
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});
const fileFilter = (req, file, cb) => {
    /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())
        ? cb(null, true)
        : cb(new Error("Chỉ cho phép file ảnh (jpg, png, webp)"));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Helper: populate thống nhất ─────────────────────────────────────────────
// Populate categoryId để các virtual field (profitMargin, discountedPrice…) hoạt động
const POPULATE_CATEGORY = { path: "categoryId", select: "name percentageDiscount fixedDiscount" };

// ─── Controller ───────────────────────────────────────────────────────────────
class FoodController {

    // 🍜 GET ALL
    async getFoods(req, res) {
        try {
            const foods = await Food.find()
                .populate(POPULATE_CATEGORY)
                .sort({ createdAt: -1 });
            res.json(foods);
        } catch (err) {
            console.error("getFoods:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // 🔍 GET BY ID
    async getFoodById(req, res) {
        try {
            const food = await Food.findById(req.params.id).populate(POPULATE_CATEGORY);
            if (!food) return res.status(404).json({ error: "Không tìm thấy món ăn" });
            res.json(food);
        } catch (err) {
            console.error("getFoodById:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // ➕ CREATE  (multipart/form-data)
    async createFood(req, res) {
        try {
            const {
                foodName,
                categoryId,          // ObjectId string
                costPrice,
                originalPrice,
                aiTrainingWeight,
                isAvailable,
                emoji,
                imageUrl: bodyImageUrl,
                ingredients,
            } = req.body;
            console.log(req.body);
            if (!foodName?.trim()) return res.status(400).json({ error: "foodName là bắt buộc" });
            if (!categoryId) return res.status(400).json({ error: "categoryId là bắt buộc" });
            if (!originalPrice) return res.status(400).json({ error: "originalPrice là bắt buộc" });

            const imageUrl = req.file
                ? `${req.protocol}://${req.get("host")}/uploads/foods/${req.file.filename}`
                : bodyImageUrl || null;

            const newFood = await Food.create({
                foodName: foodName.trim(),
                categoryId,
                costPrice: Number(costPrice) || 0,
                originalPrice: Number(originalPrice),
                aiTrainingWeight: Number(aiTrainingWeight) || 0,
                isAvailable: isAvailable !== "false" && Boolean(isAvailable ?? true),
                emoji: emoji || "🍜",
                imageUrl,
                ingredients: ingredients
                    ? (typeof ingredients === "string" ? JSON.parse(ingredients) : ingredients)
                    : [],
            });

            // Populate để trả về đầy đủ virtual fields
            await newFood.populate(POPULATE_CATEGORY);

            emitSafe("food_created", newFood);
            res.status(201).json(newFood);
        } catch (err) {
            console.error("createFood:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // ✏️ UPDATE
    async updateFood(req, res) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };

            // Ép kiểu số
            if (updateData.costPrice) updateData.costPrice = Number(updateData.costPrice);
            if (updateData.originalPrice) updateData.originalPrice = Number(updateData.originalPrice);
            if (updateData.aiTrainingWeight != null)
                updateData.aiTrainingWeight = Number(updateData.aiTrainingWeight);

            // Parse ingredients nếu gửi qua FormData
            if (typeof updateData.ingredients === "string")
                updateData.ingredients = JSON.parse(updateData.ingredients);

            // Xử lý ảnh mới
            if (req.file) {
                const old = await Food.findById(id);
                if (old?.imageUrl) _deleteLocalFile(old.imageUrl, req);
                updateData.imageUrl = `${req.protocol}://${req.get("host")}/uploads/foods/${req.file.filename}`;
            }

            const food = await Food.findByIdAndUpdate(id, updateData, { new: true })
                .populate(POPULATE_CATEGORY);

            if (!food) return res.status(404).json({ error: "Không tìm thấy món ăn" });

            emitSafe("food_updated", food);
            res.json(food);
        } catch (err) {
            console.error("updateFood:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // ❌ DELETE
    async deleteFood(req, res) {
        try {
            const food = await Food.findByIdAndDelete(req.params.id);
            if (!food) return res.status(404).json({ error: "Không tìm thấy món ăn" });

            if (food.imageUrl) _deleteLocalFile(food.imageUrl, req);

            emitSafe("food_deleted", { id: req.params.id });
            res.json({ message: "Xóa thành công" });
        } catch (err) {
            console.error("deleteFood:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // 🔎 SEARCH  ?name=...&categoryId=...
    async searchFoods(req, res) {
        try {
            const { name, categoryId } = req.query;
            const filter = {};
            if (name) filter.foodName = { $regex: name, $options: "i" };
            if (categoryId) filter.categoryId = categoryId;      // ObjectId string

            const foods = await Food.find(filter)
                .populate(POPULATE_CATEGORY)
                .sort({ createdAt: -1 });
            res.json(foods);
        } catch (err) {
            console.error("searchFoods:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // 🌱 SEED
    async seed(req, res) {
        try {
            const data = [];
            const inserted = await Food.insertMany(data);
            res.status(201).json({ message: "Seed thành công", count: inserted.length });
        } catch (err) {
            console.error("seed:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    async getAllFoods(req, res) {
        try {
            const foods = await Food.find().populate(POPULATE_CATEGORY).sort({ createdAt: -1 });
            res.json(foods);
        } catch (err) {
            console.error("getAllFoods:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    async seedAllFood(req, res) {
        try {
            const foods = [{
                "_id": "6a17c5v0fa3b7335d6d8920",
                "foodName": "Yaourt 1",
                "description": "",
                "categoryId": "Đồ chiên",
                "ingredients": [],
                "costPrice": 0,
                "originalPrice": 15000,
                "aiTrainingWeight": 0,
                "isAvailable": true,
                "soldCount": 0,
                "createdAt": "2026-05-28T04:31:28.745Z",
                "updatedAt": "2026-05-28T04:31:28.745Z",
                "__v": 0,
                "grossProfit": 15000,
                "profitMargin": 1,
                "aiScore": 0,
                "costRatio": 0,
                "profitStatus": "EXCELLENT",
                "id": "6a17c520fa3b7335d6d892b0"
            },
            {
                "_id": "6a17c5v0fa3b7335d6d892ab",
                "foodName": "Flan 2",
                "description": "",
                "categoryId": "Chủ đạo",
                "ingredients": [],
                "costPrice": 0,
                "originalPrice": 12000,
                "aiTrainingWeight": 0,
                "isAvailable": true,
                "soldCount": 0,
                "createdAt": "2026-05-28T04:30:56.133Z",
                "updatedAt": "2026-05-28T04:30:56.133Z",
                "__v": 0,
                "grossProfit": 12000,
                "profitMargin": 1,
                "aiScore": 0,
                "costRatio": 0,
                "profitStatus": "EXCELLENT",
                "id": "6a17c500fa3b7335d6d892ab"
            }];

            // ── Validate input ─────────────────────────────────────────
            if (!Array.isArray(foods) || foods.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Body phải là một mảng JSON và không được rỗng.",
                });
            }

            const results = {
                total: foods.length,
                created: 0,
                skipped: 0,
                failed: 0,
                skippedList: [],
                failedList: [],
            };

            // ── Xử lý từng food ────────────────────────────────────────
            for (const foodData of foods) {
                try {
                    // Kiểm tra trùng theo foodName + categoryId
                    const existing = await Food.findOne({
                        foodName: foodData.foodName?.trim(),
                        categoryId: foodData.categoryId?.trim(),
                    });

                    if (existing) {
                        results.skipped++;
                        results.skippedList.push({
                            foodName: foodData.foodName,
                            categoryId: foodData.categoryId,
                            reason: "Đã tồn tại trong database",
                        });
                        continue;
                    }

                    // Map ingredients nếu có
                    const ingredients = Array.isArray(foodData.ingredients)
                        ? foodData.ingredients.map((ing) => ({
                            ingredientId: ing.ingredientId,
                            ingredientName: ing.ingredientName,
                            quantity: ing.quantity,
                            unit: ing.unit,
                            cost: ing.cost,
                        }))
                        : [];

                    // Tính costPrice từ ingredients nếu không truyền
                    const computedCostPrice =
                        foodData.costPrice ??
                        ingredients.reduce((sum, ing) => sum + (ing.cost || 0), 0);

                    const newFood = new Food({
                        foodName: foodData.foodName,
                        description: foodData.description ?? "",
                        categoryId: foodData.categoryId,
                        ingredients,
                        costPrice: computedCostPrice,
                        originalPrice: foodData.originalPrice,
                        aiTrainingWeight: foodData.aiTrainingWeight ?? 0,
                        isAvailable: foodData.isAvailable ?? true,
                        soldCount: foodData.soldCount ?? 0,
                    });

                    await newFood.save();
                    results.created++;

                } catch (err) {
                    results.failed++;
                    results.failedList.push({
                        foodName: foodData.foodName,
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
                message: "Lỗi server khi import foods.",
                error: error.message,
            });
        }
    }

    async refreshFoodCosts(req, res) {
        try {
            const foods = await Food.find({ "ingredients.0": { $exists: true } });

            if (foods.length === 0) {
                return res.status(200).json({
                    message: "Không có món nào có nguyên liệu để cập nhật",
                    updatedCount: 0,
                    foods: await Food.find(),
                });
            }

            // Gom hết ingredientId cần tra giá -> 1 query duy nhất
            const ingredientIds = [
                ...new Set(foods.flatMap(f => f.ingredients.map(i => i.ingredientId.toString()))),
            ];
            const ingredientDocs = await Ingredient.find({ _id: { $in: ingredientIds } });
            const ingredientMap = new Map(ingredientDocs.map(i => [i._id.toString(), i]));

            const bulkOps = [];

            for (const food of foods) {
                let changed = false;

                const newIngredients = food.ingredients.map(row => {
                    const ing = ingredientMap.get(row.ingredientId.toString());

                    // Nguyên liệu đã bị xoá khỏi kho -> giữ nguyên, không tính lại được
                    if (!ing) return row.toObject();

                    const baseQty = ing.quantity > 0 ? ing.quantity : 1;
                    const pricePerLargeUnit = ing.pricePerLargeUnit ?? ing.cost ?? 0;
                    const unitPrice = pricePerLargeUnit / baseQty;
                    const newCost = Math.round(unitPrice * row.quantity);

                    if (newCost !== row.cost || ing.ingredientName !== row.ingredientName) {
                        changed = true;
                    }

                    return {
                        ingredientId: row.ingredientId,
                        ingredientName: ing.ingredientName, // đồng bộ luôn tên nếu đổi
                        quantity: row.quantity,
                        unit: row.unit,
                        cost: newCost,
                    };
                });

                const newCostPrice = newIngredients.reduce((s, r) => s + (r.cost || 0), 0);

                if (changed || newCostPrice !== food.costPrice) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: food._id },
                            update: { ingredients: newIngredients, costPrice: newCostPrice },
                        },
                    });
                }
            }

            if (bulkOps.length > 0) {
                await Food.bulkWrite(bulkOps);
            }

            const updatedFoods = await Food.find();

            return res.status(200).json({
                message: `Đã cập nhật giá vốn cho ${bulkOps.length} món`,
                updatedCount: bulkOps.length,
                foods: updatedFoods,
            });
        } catch (error) {
            console.error("refreshFoodCosts error:", error);
            return res.status(500).json({
                message: "Lỗi khi cập nhật giá nguyên liệu",
                error: error.message,
            });
        }
    };

    importFoods = async (req, res) => {
        try {
            const { foods } = req.body;

            if (!Array.isArray(foods) || foods.length === 0) {
                return res.status(400).json({
                    message: 'Dữ liệu import phải là một mảng và không được rỗng',
                });
            }

            const allowedFields = [
                'foodName', 'description', 'categoryId', 'ingredients',
                'costPrice', 'originalPrice', 'aiTrainingWeight',
                'isAvailable', 'soldCount', 'note', 'emoji', 'imageUrl',
            ];

            const ops = foods.map((item) => {
                const doc = {};
                allowedFields.forEach((f) => {
                    if (item[f] !== undefined) doc[f] = item[f];
                });

                // Ingredients là subdocument (_id: false trong schema)
                // nên chỉ cần đảm bảo đúng dạng mảng, không cần xử lý _id con
                if (doc.ingredients && !Array.isArray(doc.ingredients)) {
                    doc.ingredients = [];
                }

                const hasValidId = item._id && mongoose.Types.ObjectId.isValid(item._id);

                if (hasValidId) {
                    return {
                        updateOne: {
                            filter: { _id: item._id },
                            update: { $set: doc },
                            upsert: true,
                        },
                    };
                }

                return { insertOne: { document: doc } };
            });

            const result = await Food.bulkWrite(ops, { ordered: false });

            return res.status(200).json({
                message: 'Import thành công',
                matched: result.matchedCount,
                modified: result.modifiedCount,
                upserted: result.upsertedCount,
                inserted: result.insertedCount,
            });
        } catch (error) {
            console.error('Import foods error:', error);
            return res.status(500).json({
                message: 'Lỗi khi import dữ liệu',
                error: error.message,
            });
        }
    };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function _deleteLocalFile(imageUrl, req) {
    try {
        const host = `${req.protocol}://${req.get("host")}/`;
        if (!imageUrl.startsWith(host)) return;           // URL ngoài → bỏ qua
        const rel = imageUrl.replace(host, "");
        const full = path.join(__dirname, "..", rel);
        if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch { /* ignore */ }
}

// Export cả controller lẫn multer upload để dùng trong routes
module.exports = new FoodController