import { Context, Markup } from "telegraf";
import { getMainMenu, getHistoryMenu } from "../keyboards/menu";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleHistory(ctx: any, page: number = 1) {
    const tgUser = ctx.from;
    
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ 
                telegram_id: String(tgUser.id),
                page,
                limit: 5
            }),
        });

        if (res.ok) {
            const { sessions, total, totalPages } = await res.json() as any;
            
            if (!sessions || sessions.length === 0) {
                const text = `📂 *История пуста*\n\nВы еще не создавали отчетов. Попробуйте сгенерировать первый!`;
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback("« Главное меню", "main_menu")]
                ]);
                
                if (ctx.callbackQuery) {
                    await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
                } else {
                    await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
                }
                return;
            }

            const text = `📂 *Ваша история* (${total} сессий)\n` +
                         `Страница ${page} из ${totalPages}\n\n` +
                         `Выберите отчет для просмотра деталей (на сайте):`;
            
            const historyKeyboard = getHistoryMenu(sessions, page, totalPages);
            
            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: "Markdown", ...historyKeyboard });
            } else {
                await ctx.reply(text, { parse_mode: "Markdown", ...historyKeyboard });
            }
        } else {
            await ctx.reply("❌ Не удалось загрузить историю сессий.");
        }
    } catch (err) {
        console.error(err);
        await ctx.reply("⚠️ Ошибка связи с сервером.");
    }
}
