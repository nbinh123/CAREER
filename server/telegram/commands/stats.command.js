const axios = require("axios");

module.exports = (bot) => {

    bot.onText(/\/stats/, async (msg) => {

        try {

            const res = await axios.get(
                "https://career-tf7j.onrender.com/api/analyst/weekly?offset=0"
            );

            const stats = res.data.data;

            await bot.sendMessage(
                msg.chat.id,
                `📊 Thống kê tuần
------------------------------------
Doanh thu: ${stats.totalRevenue.toLocaleString()}đ
Hóa đơn: ${stats.totalBills}
Trung bình: ${stats.avgBill.toLocaleString()}đ
Chi phí: ${stats.totalCost.toLocaleString()}đ
Lợi nhuận ước tính: ${stats.totalRevenue.toLocaleString() - stats.totalCost.toLocaleString()}đ
------------------------------------
`
            );

        } catch (err) {

            console.error(err);

            await bot.sendMessage(
                msg.chat.id,
                "Không lấy được dữ liệu."
            );

        }

    });

};