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
            const createdDate = new Date(u.created_at).toLocaleDateString();
            
            const text = `👤 *Профиль пользователя*\n\n` +
                         `🆔 ID: \`${u.id}\`\n` +
                         `👤 Имя: *${u.first_name || (tgUser.first_name)}*\n` +
                         `🔗 Username: @${u.username || tgUser.username || "—"}\n` +
                         `🌟 Тариф: \`${u.account_tier || "free"}\`\n` +
                         `📅 Дата регистрации: \`${createdDate}\`\n\n` +
                         `Статистику по лимитам вы можете найти в разделе [Биллинг].`;
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback("« Назад", "main_menu")]
            ]);

            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
            } else {
                await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
            }
        }
    } catch {
        await ctx.reply("⚠️ Ошибка связи с сервером.");
    }
}
