// telegram/callbacks/storage.callback.js
//
// Xử lý toàn bộ nút trong submenu "🥬 Kho nguyên liệu". callback_data
// dạng "storage:<action>".
//
// IngredientModel không có field ngưỡng "tối thiểu" nào cả, nên "cần
// chú ý" được suy ra từ 2 field có sẵn: quantity <= 0 (đã hết) và
// needContinuousRestock (nguyên liệu tươi cần bổ sung liên tục).
const api = require("../services/api.service");
const { storageKeyboard } = require("../keyboards/storage.keyboard");

async function render(bot, query, text) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            ...storageKeyboard,
        });
    } catch (err) {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", ...storageKeyboard });
    }
}

module.exports = async function handleStorage(bot, query) {
    const [, action] = query.data.split(":");
    const ingredients = await api.getIngredients();

    switch (action) {
        case "alert": {
            const outOfStock = ingredients.filter((i) => (i.quantity ?? 0) <= 0);
            const needRestock = ingredients.filter(
                (i) => i.needContinuousRestock && (i.quantity ?? 0) > 0
            );

            const lines = [];
            if (outOfStock.length) {
                lines.push("🔴 <b>Đã hết:</b>");
                lines.push(...outOfStock.map((i) => `  • ${i.ingredientName}`));
            }
            if (needRestock.length) {
                lines.push(lines.length ? "\n🟡 <b>Cần bổ sung liên tục:</b>" : "🟡 <b>Cần bổ sung liên tục:</b>");
                lines.push(
                    ...needRestock.map((i) => `  • ${i.ingredientName} — còn ${i.quantity} ${i.smallUnit}`)
                );
            }

            const text = lines.length
                ? "⚠️ <b>Nguyên liệu cần chú ý</b>\n━━━━━━━━━━━━━━━\n" + lines.join("\n")
                : "✅ Không có nguyên liệu nào cần chú ý.";

            await render(bot, query, text);
            break;
        }

        case "all": {
            const sorted = ingredients.slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
            const shown = sorted.slice(0, 30);
            const lines = shown.map((i) => `• ${i.ingredientName}: ${i.quantity} ${i.smallUnit}`);

            const text =
                `📋 <b>Nguyên liệu (${ingredients.length})</b>\n━━━━━━━━━━━━━━━\n` +
                (lines.length ? lines.join("\n") : "Chưa có nguyên liệu nào.") +
                (ingredients.length > shown.length ? `\n… và ${ingredients.length - shown.length} mục khác` : "");

            await render(bot, query, text);
            break;
        }
    }
};
