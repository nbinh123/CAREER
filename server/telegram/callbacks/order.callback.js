module.exports = (bot) => {

    bot.on("callback_query", async (query) => {

        if (!query.data.startsWith("order_")) return;

        try {

            switch (query.data) {

                case "order_pending":
                    break;

                case "order_cooking":
                    break;

                case "order_done":
                    break;
            }

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