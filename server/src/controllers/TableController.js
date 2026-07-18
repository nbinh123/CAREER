// controllers/TableController.js
const Table = require("../models/TableModel");

// Chuẩn hoá document Mongo về đúng shape mà front-end (admin + client)
// đang mong đợi từ trước tới giờ: { id, name, status, since, items }
const toClientTable = (t) => ({
    id: t.number,
    name: t.name,
    status: t.status,
    since: t.since,
    items: t.items || [],
});

class TableController {
    // 📋 GET tất cả bàn (dùng cho admin, hoặc debug)
    async getTables(req, res) {
        try {
            const tables = await Table.find().sort({ number: 1 });
            res.json(tables.map(toClientTable));
        } catch (err) {
            console.error("getTables:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // 🔍 GET 1 bàn theo số bàn — client gọi lúc mới load trang,
    // trước khi socket kịp kết nối / join room
    async getTableByNumber(req, res) {
        try {
            const number = Number(req.params.number);
            if (!Number.isInteger(number)) {
                return res.status(400).json({ error: "Số bàn không hợp lệ" });
            }

            const table = await Table.findOne({ number });
            if (!table) {
                return res.status(404).json({ error: "Không tìm thấy bàn" });
            }

            res.json(toClientTable(table));
        } catch (err) {
            console.error("getTableByNumber:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }

    // 🌱 SEED — chỉ dùng khi setup lần đầu / môi trường dev.
    // Lưu ý: socket.js cũng tự seed 12 bàn mặc định lúc khởi động nếu
    // DB chưa có bàn nào, nên bình thường KHÔNG cần gọi route này.
    async seedTables(req, res) {
        try {
            const count = await Table.countDocuments();
            if (count > 0) {
                return res.status(400).json({
                    error: `Đã có ${count} bàn trong DB, không seed lại`,
                });
            }

            const total = Number(req.body?.count) || 12;
            const docs = Array.from({ length: total }, (_, i) => ({
                number: i + 1,
                name: `Bàn ${i + 1}`,
                status: "empty",
                since: null,
                items: [],
            }));

            const inserted = await Table.insertMany(docs);
            res.status(201).json({ message: "Seed thành công", count: inserted.length });
        } catch (err) {
            console.error("seedTables:", err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }
}

module.exports = new TableController();