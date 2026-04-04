import { Context, Markup } from "telegraf";
import { getMainMenu } from "../keyboards/menu";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleBilling(ctx: any) {
    const tgUser = ctx.from;
    
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/billing`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ telegram_id: String(tgUser.id) }),
        });

        if (res.ok) {
            const { billing: b } = await res.json() as any;
            
            const text = `💳 *Подписка и лимиты*\n\n` +
                         `👤 ID: \`${b.id}\`\n` +
                         `🌟 Тариф: *${b.tier.toUpperCase()}*\n\n` +
                         `📊 *Использование сегодня*:\n` +
                         `• Сообщений: ${b.daily_chars.used.toLocaleString()} / ${b.daily_chars.max.toLocaleString()} симв.\n` +
                         `• Отчетов: ${b.generations.reports_daily} / ${b.generations.reports_max}\n` +
                         `• Визуализаций: ${b.generations.visuals_daily}\n\n` +
                         `📅 *Период*:\n` +
                         `• Сброс дневных лимитов: \`${b.resets.daily || "—"}\`\n` +
                         `• Недельный израсходован: ${b.weekly_chars.used.toLocaleString()} / ${b.weekly_chars.max.toLocaleString()} симв.\n\n` +
                         `💰 *Платные ресурсы*:\n` +
                         `• Доступно chars: ${b.purchased.chars.toLocaleString()}\n` +
                         `• Доступно visuals: ${b.purchased.visuals}\n\n` +
                         `🔗 [Управление биллингом на сайте](https://perricheno.ru/billing)`;
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback("« Назад", "main_menu")]
            ]);

            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
            } else {
                await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
            }
        } else {
            await ctx.reply("❌ Не удалось загрузить данные биллинга.");
        }
    } catch (err) {
        console.error(err);
        await ctx.reply("⚠️ Ошибка связи с сервером.");
    }
}
