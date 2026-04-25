import { Markup } from "telegraf";
import { escapeMarkdown } from "../utils/format";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleReferral(ctx: any) {
    const tgUser = ctx.from;

    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/referral`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ telegram_id: String(tgUser.id) }),
        });

        if (res.ok) {
            const { stats, referralLink } = await res.json() as any;
            
            const text = `👥 *Реферальная система*\n\n` +
                         `Приглашайте друзей и получайте бонусы за их регистрацию!\n\n` +
                         `🎁 Бонус за друга: *100 000 символов*\n\n` +
                         `📊 *Ваша статистика:*\n` +
                         `• Приглашено друзей: \`${stats.invitedCount}\`\n` +
                         `• Получено бонусов: \`${stats.totalBonus.toLocaleString()}\` символов\n\n` +
                         `🔗 *Ваша ссылка для приглашения:*\n` +
                         `\`${referralLink}\`\n\n` +
                         `_Просто скопируйте ссылку выше и отправьте её друзьям._`;

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.url("📢 Поделиться", `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Попробуй Perricheno - ИИ для глубокой визуализации данных!")}`)],
                [Markup.button.callback("« Назад", "main_menu")]
            ]);

            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
            } else {
                await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
            }
        }
    } catch (err) {
        console.error("Referral handler error:", err);
        await ctx.reply("⚠️ Ошибка при загрузке реферальной статистики.");
    }
}
