// telegram/services/api.service.js
//
// Bot gọi sang API backend qua HTTP như 1 client bình thường (KHÔNG
// import trực tiếp Model/Controller của src/) — giữ 2 phần độc lập,
// và bot vẫn hoạt động đúng nếu sau này được tách ra chạy process riêng.
// Tất cả route dưới đây đều đang public (không có authMiddleware áp
// vào trong routes.js hiện tại), giống cách stats.command.js cũ gọi.

const axios = require("axios");
const { API_BASE_URL } = require("../config");

const http = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15_000, // Render free tier có thể "ngủ" và mất vài giây thức dậy
});

// Hầu hết controller trả { success: true, data: ... } — bóc sẵn field
// "data" ở đây để chỗ gọi không phải lặp lại res.data.data mỗi lần.
async function get(path, params) {
    const res = await http.get(path, { params });
    return res.data && Object.prototype.hasOwnProperty.call(res.data, "data")
        ? res.data.data
        : res.data;
}

module.exports = {
    // ── Thống kê (AnalystController) ──────────────────────────────────
    getTodayChart: () => get("/api/analyst/chart-data", { tf: "day" }),
    getStats: () => get("/api/analyst/stats"),
    getLast7DaysRevenue: () => get("/api/analyst/week-revenue"),
    getWeeklySummary: (offset = 0) => get("/api/analyst/weekly", { offset }),
    getMonthlySummary: (offset = 0) => get("/api/analyst/monthly-summary", { offset }),
    getTopDishes: (period = "day") => get("/api/analyst/top-dishes", { period }),

    // ── Đơn hàng & bàn ─────────────────────────────────────────────────
    // Lưu ý: GET /api/orders trả TOÀN BỘ lịch sử (không có ?limit ở
    // OrderController hiện tại) — bot tự cắt lấy vài đơn đầu sau khi
    // nhận về. Nếu sau này lịch sử đơn lớn, nên thêm phân trang ở
    // OrderController rồi đổi lại chỗ gọi này.
    getOrders: () => get("/api/orders"),
    getTables: () => get("/api/tables"),

    // ── Kho nguyên liệu ────────────────────────────────────────────────
    getIngredients: () => get("/api/ingredients"),
};
