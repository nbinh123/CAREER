const Fruit = require("../models/FruitModel");
const Food = require("../models/FoodModel");

// ⚠️ CẦN BẠN KIỂM TRA LẠI: chỗ lấy URL ảnh sau khi upload phải khớp với
// cách FoodController hiện tại đang xử lý (multer lưu local trả về
// req.file.path, hay multer-storage-cloudinary trả về req.file.path là URL
// Cloudinary luôn, hay field khác như req.file.secure_url/location...).
// Mình để 3 khả năng phổ biến nhất, ưu tiên theo thứ tự — bạn xoá bớt cho
// khớp đúng 1 cách đang dùng để tránh nhầm lẫn.
function resolveImageUrl(req) {
    if (!req.file) return undefined;
    return req.file.path || req.file.secure_url || req.file.location;
}

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

    //  [POST]  /fruits  (multipart nếu có ảnh, JSON thuần nếu không — xem FruitService.js)
    createFruit = async (req, res) => {
        try {
            const payload = { ...req.body };
            const imageUrl = resolveImageUrl(req);
            if (imageUrl) payload.imageUrl = imageUrl;

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
            const imageUrl = resolveImageUrl(req);
            if (imageUrl) payload.imageUrl = imageUrl;

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

module.exports = new FruitController();