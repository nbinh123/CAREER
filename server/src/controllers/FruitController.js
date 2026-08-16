const multer = require("multer");
const path = require("path");
const Fruit = require("../models/FruitModel");
const Food = require("../models/FoodModel");
const cloudinary = require("../config/cloudinary");
const uploadBufferToCloudinary = require("../utils/uploadToCloudinary");
const MIX_CATEGORY = "Trái cây mix";
// ─── Multer ───────────────────────────────────────────────────────────────
// memoryStorage — không ghi file ra ổ đĩa, buffer nhận từ multer được đẩy
// thẳng lên Cloudinary trong createFruit/updateFruit. Giống hệt FoodController.
const storage = multer.memoryStorage();

const normalizeText = (str) => {
    return (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
};

const parseComboParts = (foodName) => {
    return (foodName || "")
        .split("-")
        .map((part) => part.trim())
        .filter(Boolean);
};

const fileFilter = (req, file, cb) => {
    /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())
        ? cb(null, true)
        : cb(new Error("Chỉ cho phép file ảnh (jpg, png, webp)"));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

class FruitController {

    //  [GET]   /fruits
    getAllFruits = async (req, res) => {
        try {
            const fruits = await Fruit.find().sort({ createdAt: -1 });
            res.json({ success: true, data: fruits });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    //  [GET]   /fruits/search?q=...
    searchFruits = async (req, res) => {
        try {
            const { q = "" } = req.query;
            const filter = q ? { fruitName: { $regex: q, $options: "i" } } : {};
            const fruits = await Fruit.find(filter).sort({ createdAt: -1 });
            res.json({ success: true, data: fruits });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    //  [GET]   /fruits/:id
    getFruitById = async (req, res) => {
        try {
            const fruit = await Fruit.findById(req.params.id);
            if (!fruit) {
                return res.status(404).json({ success: false, message: "Không tìm thấy loại trái cây" });
            }
            res.json({ success: true, data: fruit });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    //  [POST]  /fruits  (multipart nếu có ảnh — field "image", JSON thuần nếu không)
    createFruit = async (req, res) => {
        try {
            const payload = { ...req.body };

            // Có file ảnh gửi kèm (multipart, field "image") -> đẩy lên Cloudinary
            if (req.file) {
                const uploaded = await uploadBufferToCloudinary(req.file.buffer);
                payload.imageUrl = uploaded.secure_url;
                payload.imagePublicId = uploaded.public_id;
            }

            const fruit = await Fruit.create(payload);
            res.status(201).json({ success: true, data: fruit });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ success: false, message: "Loại trái cây này đã tồn tại" });
            }
            res.status(400).json({ success: false, message: err.message });
        }
    }

    //  [PUT]   /fruits/:id
    updateFruit = async (req, res) => {
        try {
            const payload = { ...req.body };

            // Có ảnh mới -> xoá ảnh cũ trên Cloudinary (nếu có publicId lưu từ
            // trước) rồi upload ảnh mới, thay cả imageUrl + imagePublicId.
            // Giống hệt FoodController.updateFood.
            if (req.file) {
                const old = await Fruit.findById(req.params.id);
                if (old?.imagePublicId) await _deleteCloudinaryImage(old.imagePublicId);

                const uploaded = await uploadBufferToCloudinary(req.file.buffer);
                payload.imageUrl = uploaded.secure_url;
                payload.imagePublicId = uploaded.public_id;
            }

            const fruit = await Fruit.findByIdAndUpdate(req.params.id, payload, {
                new: true,
                runValidators: true,
            });
            if (!fruit) {
                return res.status(404).json({ success: false, message: "Không tìm thấy loại trái cây" });
            }
            res.json({ success: true, data: fruit });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ success: false, message: "Loại trái cây này đã tồn tại" });
            }
            res.status(400).json({ success: false, message: err.message });
        }
    }

    //  [DELETE]  /fruits/:id
    deleteFruit = async (req, res) => {
        try {
            const fruit = await Fruit.findByIdAndDelete(req.params.id);
            if (!fruit) {
                return res.status(404).json({ success: false, message: "Không tìm thấy loại trái cây" });
            }

            if (fruit.imagePublicId) await _deleteCloudinaryImage(fruit.imagePublicId);

            res.json({ success: true, data: fruit });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    getComboFruits = async (req, res) => {
        try {
            const foods = await Food.find({
                categoryId: "Trái cây mix",
            }).sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                count: foods.length,
                data: foods,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Lỗi khi lấy danh sách trái cây mix",
            });
        }
    }

    // [GET] /fruits/mix
    // Dữ liệu dành riêng cho trang khách chọn combo trái cây
    getMixOptions = async (req, res) => {
        try {
            // Lấy song song vì 2 collection độc lập
            const [fruits, foods] = await Promise.all([
                Fruit.find().sort({ createdAt: -1 }),
                Food.find({
                    categoryId: MIX_CATEGORY,
                    isAvailable: true,
                }).sort({ createdAt: -1 }),
            ]);

            // Set tên các loại trái cây ĐANG BÁN
            const availableFruitNames = new Set(
                fruits
                    .filter((fruit) => fruit.isAvailable)
                    .map((fruit) => normalizeText(fruit.fruitName))
            );

            // Chỉ giữ combo:
            // 1. Food thuộc category "Trái cây mix"
            // 2. Food đang bán
            // 3. Có đúng 3 thành phần
            // 4. Cả 3 thành phần đều tồn tại
            // 5. Cả 3 thành phần đều đang bán
            const combos = foods
                .map((food) => ({
                    ...food.toObject(),
                    id: food._id,
                    comboParts: parseComboParts(food.foodName),
                }))
                .filter((food) => {
                    if (food.comboParts.length !== 3) {
                        return false;
                    }

                    return food.comboParts.every((part) =>
                        availableFruitNames.has(normalizeText(part))
                    );
                });

            res.status(200).json({
                success: true,
                data: {
                    fruits,
                    combos,
                },
            });
        } catch (error) {
            console.error("[FruitController] getMixOptions:", error);

            res.status(500).json({
                success: false,
                message: "Lỗi khi lấy dữ liệu mix trái cây",
            });
        }
    };
}

// ─── Helper ───────────────────────────────────────────────────────────────
// Xoá ảnh cũ trên Cloudinary qua public_id đã lưu ở FruitModel.imagePublicId.
async function _deleteCloudinaryImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        // Không throw — ảnh cũ xoá lỗi không nên chặn việc lưu trái cây mới/đã sửa
        console.error("_deleteCloudinaryImage:", err.message);
    }
}

const fruitController = new FruitController();
fruitController.upload = upload; // để route dùng: upload.single('image')
module.exports = fruitController;