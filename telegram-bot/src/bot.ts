import { Telegraf } from "telegraf";

// ── Environment ──
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN; // e.g. https://perricheno.ru
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PORT = parseInt(process.env.BOT_PORT || "3001", 10);

if (!BOT_TOKEN) {
    console.error("FATAL: TELEGRAM_BOT_TOKEN is not set.");
    process.exit(1);
}

if (!WEBHOOK_SECRET) {
    console.error("FATAL: WEBHOOK_SECRET is not set. Refusing to start with no auth.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ── /start handler — Deep Link Auth ──
bot.start(async (ctx) => {
    const payload = ctx.startPayload; // The UUID token from the deep link
    const tgUser = ctx.from;

    if (payload && payload.length > 10) {
        // This is an auth request — verify with the main site
        console.log(`[AUTH] User ${tgUser.id} (@${tgUser.username}) started with token: ${payload}`);

        try {
            const res = await fetch(`${SITE_URL}/api/internal/bot/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Bot-Secret": WEBHOOK_SECRET,
                },
                body: JSON.stringify({
                    token: payload,
                    user: {
                        id: tgUser.id,
                        username: tgUser.username || "",
                        first_name: tgUser.first_name || "",
                        photo_url: "", // Telegram bot API doesn't give photo in /start
                    },
                }),
            });

            if (res.ok) {
                await ctx.reply(
                    `✅ *Вы успешно авторизованы!*\n\nВернитесь в браузер — вход произойдет автоматически.`,
                    { parse_mode: "Markdown" }
                );
            } else {
                const errData = await res.json().catch(() => ({ error: "Unknown" })) as any;
                console.error("[AUTH] Verification failed:", errData);
                await ctx.reply(
                    `❌ Ссылка устарела или недействительна.\n\nПопробуйте нажать "Войти" на сайте ещё раз.`
                );
            }
        } catch (err) {
            console.error("[AUTH] Network error:", err);
            await ctx.reply("⚠️ Сервер временно недоступен. Попробуйте позже.");
        }
    } else {
        // Regular /start — welcome message
        await ctx.reply(
            `👋 Привет, *${tgUser.first_name}*!\n\n` +
            `Я бот платформы *Perricheno* — вашего ИИ-ассистента для академических исследований.\n\n` +
            `🔑 Для входа на сайт нажмите *\"Войти\"* на [perricheno.ru](https://perricheno.ru) — я мгновенно авторизую вас.\n\n` +
            `📦 Здесь вы также будете получать чеки, уведомления и статусы ваших задач.`,
            { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
        );
    }
});

// ── /help command ──
bot.help(async (ctx) => {
    await ctx.reply(
        `📋 *Команды:*\n\n` +
        `/start — Приветствие и авторизация\n` +
        `/me — Информация о вашем аккаунте\n` +
        `/help — Эта справка\n\n` +
        `💬 По вопросам: @perricheno`,
        { parse_mode: "Markdown" }
    );
});

// ── /me command — account info ──
bot.command("me", async (ctx) => {
    const tgUser = ctx.from;
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/user-info`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Bot-Secret": WEBHOOK_SECRET,
            },
            body: JSON.stringify({ telegram_id: String(tgUser.id) }),
        });

        if (res.ok) {
            const data = await res.json() as any;
            const u = data.user;
            await ctx.reply(
                `👤 *${u.first_name}* (@${u.username || "—"})\n\n` +
                `📊 Тариф: \`${u.account_tier || "free"}\`\n` +
                `📝 Символы сегодня: ${(u.daily_chars_used || 0).toLocaleString()}\n` +
                `📄 Отчёты: ${u.daily_reports_used || 0} использовано\n` +
                `💰 Куплено символов: ${(u.purchased_chars || 0).toLocaleString()}\n` +
                `📑 Куплено отчётов: ${u.purchased_reports || 0}`,
                { parse_mode: "Markdown" }
            );
        } else {
            await ctx.reply("❌ Вы ещё не зарегистрированы на платформе. Зайдите на perricheno.ru и войдите.");
        }
    } catch {
        await ctx.reply("⚠️ Не удалось связаться с сервером.");
    }
});

// ── Launch ──
async function main() {
    if (WEBHOOK_DOMAIN) {
        // Production: Webhook mode (fastest, no polling overhead)
        const webhookPath = `/webhook/${BOT_TOKEN}`;
        const webhookUrl = `${WEBHOOK_DOMAIN}/api/webhook/telegram`;

        // Set webhook via Telegram API
        await bot.telegram.setWebhook(webhookUrl, {
            secret_token: WEBHOOK_SECRET,
        });

        // Start lightweight HTTP server to receive updates
        await bot.launch({
            webhook: {
                domain: WEBHOOK_DOMAIN,
                path: webhookPath,
                port: PORT,
                secretToken: WEBHOOK_SECRET,
            },
        });

        console.log(`🚀 Bot launched in WEBHOOK mode on port ${PORT}`);
        console.log(`   Webhook URL: ${webhookUrl}`);
    } else {
        // Development fallback: Long polling
        await bot.launch();
        console.log("🚀 Bot launched in POLLING mode (dev)");
    }
}

main().catch((err) => {
    console.error("Bot failed to start:", err);
    process.exit(1);
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
