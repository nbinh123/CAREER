const { TelegramBot } = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
    polling: true,
});

// Đăng ký commands
require("./commands")(bot);

// Đăng ký callbacks
require("./callbacks")(bot);

module.exports = bot;