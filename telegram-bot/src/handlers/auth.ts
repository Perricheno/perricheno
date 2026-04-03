import { Context, Markup } from "telegraf";
import { getMainMenu, getVisualMenu } from "../keyboards/menu";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleStart(ctx: any) {
    const payload = ctx.startPayload;
    const tgUser = ctx.from;

    if (payload && payload.length > 10) {
        try {
            const res = await fetch(`${SITE_URL}/api/internal/bot/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                body: JSON.stringify({
                    token: payload,
                    user: { id: tgUser.id, username: tgUser.username || "", first_name: tgUser.first_name || "" }
                }),
            });

            if (res.ok) {
                await ctx.reply(`✅ *Авторизация успешна!*\n\nИспользуйте меню ниже для работы.`, {
                    parse_mode: "Markdown",
                    ...getMainMenu()
                });
            } else {
                await ctx.reply(`❌ Ошибка авторизации. Попробуйте войти заново на сайте.`);
            }
        } catch (err) {
            await ctx.reply("⚠️ Сервер временно недоступен.");
        }
    } else {
        await ctx.reply(
            `👋 Привет, *${tgUser.first_name}*!\n\nЯ умный помощник *Perricheno*. Выберите действие:`,
            { parse_mode: "Markdown", ...getMainMenu() }
        );
    }
}

export async function handleMe(ctx: any) {
    const tgUser = ctx.from;
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/user-info`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ telegram_id: String(tgUser.id) }),
        });

        if (res.ok) {
            const { user: u } = await res.json() as any;
            const text = `👤 *${u.first_name}* (@${u.username || "—"})\n\n` +
                         `📊 Тариф: \`${u.account_tier || "free"}\`\n` +
                         `📝 Символы: ${(u.daily_chars_used || 0).toLocaleString()}\n` +
                         `📑 Отчёты: ${u.daily_reports_used || 0}\n` +
                         `💰 Баланс: ${(u.purchased_chars || 0).toLocaleString()} chars`;
            
            await ctx.editMessageText(text, { parse_mode: "Markdown", ...getMainMenu() });
        }
    } catch {
        await ctx.reply("⚠️ Ошибка связи с сервером.");
    }
}
