const FruitOrder = require("../models/FruitOrderModel");
const Fruit = require("../models/FruitModel");

class FruitOrderController {

    //  [GET]   /fruit-orders/top-combos?limit=6
    //  Gợi ý combo bán chạy nhất — group theo comboKey, cộng dồn quantity,
    //  sắp xếp giảm dần. Chỉ trả về combo mà CẢ 3 loại vẫn còn tồn tại VÀ
    //  đang bán (isAvailable) trong Fruit collection.
    //  Lưu ý: hiện KHÔNG dùng cho phần gợi ý ở FruitPage.jsx phía khách nữa
    //  (đã chuyển sang match theo combo có sẵn trong Food) — giữ lại phục
    //  vụ thống kê/báo cáo sau này.
    getTopCombos = async (req, res) => {
        try {
            const limit = Math.min(Number(req.query.limit) || 6, 20);

            const stats = await FruitOrder.aggregate([
                {
                    $group: {
                        _id: "$comboKey",
                        orderCount: { $sum: 1 },
                        totalQuantity: { $sum: "$quantity" },
                        fruits: { $first: "$fruits" },
                    },
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: limit * 2 }, // lấy dư ra để bù các combo bị lọc bỏ ở bước sau
            ]);

            const fruitIds = [...new Set(stats.flatMap((s) => s.fruits.map((f) => String(f.fruitId))))];
            const fruitsInDb = await Fruit.find({ _id: { $in: fruitIds } });
            const fruitMap = new Map(fruitsInDb.map((f) => [String(f._id), f]));

            const result = stats
                .map((s) => {
                    const resolvedFruits = s.fruits.map((f) => fruitMap.get(String(f.fruitId))).filter(Boolean);
                    if (resolvedFruits.length !== 3) return null; // có loại đã bị xoá khỏi hệ thống
                    if (resolvedFruits.some((f) => !f.isAvailable)) return null; // có loại đang tạm nghỉ bán

                    return {
                        comboKey: s._id,
                        orderCount: s.orderCount,
                        totalQuantity: s.totalQuantity,
                        fruits: resolvedFruits.map((f) => ({
                            fruitId: f._id,
                            fruitName: f.fruitName,
                            imageUrl: f.imageUrl,
                        })),
                    };
                })
                .filter(Boolean)
                .slice(0, limit);

            res.json({ success: true, data: result });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
}

module.exports = new FruitOrderController();