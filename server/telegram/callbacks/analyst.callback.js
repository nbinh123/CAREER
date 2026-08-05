module.exports = (bot) => {

    bot.on("callback_query", async (query) => {

        if (query.data !== "menu_analyst") return;

        try {

            // TODO:
            // Xử lý callback thống kê

            await bot.answerCallbackQuery(query.id);

        } catch (err) {

            console.error(err);

            await bot.answerCallbackQuery(query.id, {
                text: "Đã xảy ra lỗi.",
                show_alert: true
            });

        }

    });

};