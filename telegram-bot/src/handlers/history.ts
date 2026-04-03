import { Markup } from "telegraf";
import { getMainMenu, getVisualMenu, getHistoryMenu } from "../keyboards/menu";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleHistory(ctx: any, page: number = 1) {
    try {
        const tgUser = ctx.from;
        // Fetch real history from site
        const res = await fetch(`${SITE_URL}/api/internal/bot/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ telegram_id: String(tgUser.id), page, limit: 10 }),
        });

        if (res.ok) {
            const { chats, totalPages } = await res.json() as any;
            const text = `📜 *История ваших чатов* (Стр. ${page})\n\nВыберите чат для просмотра деталей или продолжения:`;
            
            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: "Markdown", ...getHistoryMenu(chats, page, totalPages) });
            } else {
                await ctx.reply(text, { parse_mode: "Markdown", ...getHistoryMenu(chats, page, totalPages) });
            }
        } else {
            // Fallback for demo if no chats yet
            const mockChats = Array.from({ length: 5 }).map((_, i) => ({ id: i, title: `Исследование #${i + 1}` }));
            await ctx.editMessageText("📜 *История чатов (Демо mode)*", {
                parse_mode: "Markdown",
                ...getHistoryMenu(mockChats, 1, 1)
            });
        }
    } catch (err) {
        await ctx.reply("⚠️ Не удалось загрузить историю.");
    }
}
