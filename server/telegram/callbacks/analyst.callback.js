// telegram/callbacks/analyst.callback.js
//
// Xử lý toàn bộ nút trong submenu "📊 Thống kê". callback_data dạng
// "analyst:<action>[:<param>]".
const api = require("../services/api.service");
const { analystKeyboard } = require("../keyboards/analyst.keyboard");
const { money, bar } = require("../utils/format");

async function render(bot, query, text) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            ...analystKeyboard,
        });
    } catch (err) {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", ...analystKeyboard });
    }
}

module.exports = async function handleAnalyst(bot, query) {
    const [, action, param] = query.data.split(":");

    switch (action) {
        case "today": {
            // /api/analyst/chart-data?tf=day trả 15 mốc giờ (7h-21h) của
            // hôm nay — cộng dồn lại để ra tổng cả ngày.
            const rows = await api.getTodayChart();
            const t = rows.reduce(
                (acc, r) => ({
                    revenue: acc.revenue + (r.revenue || 0),
                    bills: acc.bills + (r.bills || 0),
                    cost: acc.cost + (r.cost || 0),
                    profit: acc.profit + (r.profit || 0),
                }),
                { revenue: 0, bills: 0, cost: 0, profit: 0 }
            );
            const avgBill = t.bills > 0 ? Math.round(t.revenue / t.bills) : 0;

            await render(
                bot,
                query,
                "📅 <b>Thống kê hôm nay</b>\n" +
                    "━━━━━━━━━━━━━━━\n" +
                    `💰 Doanh thu: <b>${money(t.revenue)}</b>\n` +
                    `🧾 Số hoá đơn: ${t.bills}\n` +
                    `📊 TB/hoá đơn: ${money(avgBill)}\n` +
                    `💸 Chi phí: ${money(t.cost)}\n` +
                    `📈 Lợi nhuận gộp: ${money(t.profit)}`
            );
            break;
        }

        case "7d": {
            const [stats, days] = await Promise.all([api.getStats(), api.getLast7DaysRevenue()]);
            const max = Math.max(1, ...days.map((d) => d.v));
            const lines = days.map((d) => `${d.d.padEnd(6)} ${bar(d.v, max)}  ${money(d.v)}`);

            await render(
                bot,
                query,
                "🔄 <b>7 ngày gần nhất</b>\n" +
                    "━━━━━━━━━━━━━━━\n" +
                    `💰 Tổng doanh thu: <b>${money(stats.totalRev)}</b>\n` +
                    `🧾 Tổng hoá đơn: ${stats.totalBills}\n` +
                    `📊 TB/hoá đơn: ${money(stats.avgBill)}\n\n` +
                    lines.join("\n")
            );
            break;
        }

        case "week": {
            const offset = Number(param) || 0;
            const data = await api.getWeeklySummary(offset);
            const max = Math.max(1, ...data.days.map((d) => d.revenue));
            const lines = data.days.map((d) => `${d.label.padEnd(3)} ${bar(d.revenue, max)}  ${money(d.revenue)}`);

            await render(
                bot,
                query,
                `🗓️ <b>${offset === 0 ? "Tuần này" : "Tuần trước"}</b>\n` +
                    "━━━━━━━━━━━━━━━\n" +
                    `💰 Doanh thu: <b>${money(data.totalRevenue)}</b>\n` +
                    `🧾 Hoá đơn: ${data.totalBills}\n` +
                    `📊 TB/hoá đơn: ${money(data.avgBill)}\n` +
                    `💸 Chi phí: ${money(data.totalCost)}\n\n` +
                    lines.join("\n")
            );
            break;
        }

        case "month": {
            const offset = Number(param) || 0;
            const data = await api.getMonthlySummary(offset);

            await render(
                bot,
                query,
                `📆 <b>${offset === 0 ? "Tháng này" : "Tháng trước"}</b>\n` +
                    "━━━━━━━━━━━━━━━\n" +
                    `💰 Doanh thu: <b>${money(data.totalRevenue)}</b>\n` +
                    `🧾 Hoá đơn: ${data.totalBills}\n` +
                    `📊 TB/hoá đơn: ${money(data.avgBill)}\n` +
                    `💸 Chi phí: ${money(data.totalCost)}\n` +
                    `📈 Lợi nhuận gộp: ${money(data.totalProfit)}`
            );
            break;
        }

        case "top": {
            const period = param === "week" ? "week" : "day";
            const data = await api.getTopDishes(period);
            const lines = data.length
                ? data.map((d, i) => `${i + 1}. ${d.name} — ${d.value} món`)
                : ["Chưa có dữ liệu."];

            await render(
                bot,
                query,
                `🏆 <b>Top món bán chạy (${period === "week" ? "tuần này" : "hôm nay"})</b>\n` +
                    "━━━━━━━━━━━━━━━\n" +
                    lines.join("\n")
            );
            break;
        }
    }
};
