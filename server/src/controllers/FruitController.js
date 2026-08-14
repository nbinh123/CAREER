const multer = require("multer");
const path = require("path");
const Fruit = require("../models/FruitModel");
const Food = require("../models/FoodModel");
const cloudinary = require("../config/cloudinary");
const uploadBufferToCloudinary = require("../utils/uploadToCloudinary");

// ─── Multer ───────────────────────────────────────────────────────────────
// memoryStorage — không ghi file ra ổ đĩa, buffer nhận từ multer được đẩy
// thẳng lên Cloudinary trong createFruit/updateFruit. Giống hệt FoodController.
const storage = multer.memoryStorage();
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