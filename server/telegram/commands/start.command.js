const { mainMenu } = require("../menu");

module.exports = (bot) => {

    bot.onText(/\/start/, async (msg) => {

        await bot.sendMessage(
            msg.chat.id,
            "Ông chủ cần gì ạ ^^",
            mainMenu
        );

    });

};