import { Telegraf, Context } from "telegraf";
import { handleStart, handleMe } from "./handlers/auth";
import { handleVisualStart, handleVisualName, handleVisualCollect, handleVisualGenerateRequest, handleVisualProcess, handleVisualReset, handleVisualToggleType, handleCompileStart, handleCompileFile } from "./handlers/visual";
import { handleHistory, handleViewSession, handleDownloadFile, handleViewImages } from "./handlers/history";
import { handleBilling, handleBillingShop, handleBillingCategory, handleBillingBuy, handleBillingConfirm, handleBillingHistory, handleBillingPromoStart, handleBillingPromoApply } from "./handlers/billing";
import { handleReferral } from "./handlers/referral";
import { handleActiveTasks, handleTaskReset } from "./handlers/tasks";
import { getMainMenu, getVisualSuggestionsKeyboard, getLangSelectionKeyboard, getVisualActionKeyboard } from "./keyboards/menu";
import { getSession, saveSession } from "./sessionStore";

import http from "http";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_INTERNAL_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const BOT_PORT = process.env.BOT_PORT || 3001;

if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error("FATAL: Environment variables (BOT_TOKEN, WEBHOOK_SECRET) are not set.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN) as any;

// --- In-Memory Session Middleware ---

bot.use(async (ctx: any, next: () => Promise<void>) => {
    const userId = ctx.from?.id;
    if (!userId) return next();
    
    // 1. Load session from API
    ctx.session = await getSession(userId);
    
    // 2. Wrap next() to save session back to API after execution
    await next();
    
    // 3. Save session back
    await saveSession(userId, ctx.session);
});



// --- Commands ---
bot.start(ctx => handleStart(ctx));
bot.command("me", ctx => handleMe(ctx));
bot.command("history", ctx => handleHistory(ctx));
bot.command("billing", ctx => handleBilling(ctx));

// --- Actions (Callbacks) ---
bot.action(/^toggle_type_(.+)$/, ctx => handleVisualToggleType(ctx));
bot.action("main_menu", async (ctx: any) => {
    ctx.session.step = 'idle';
    await ctx.answerCbQuery();
    
    const text = `🏠 *Главное меню*\n\nВыберите нужный инструмент:`;
    const keyboard = getMainMenu();

    try {
        // Try editing existing message
        await ctx.editMessageText(text, {
            parse_mode: "Markdown",
            ...keyboard
        });
    } catch (err) {
        // If it fails (e.g. current message is a photo), delete and send new
        try { await ctx.deleteMessage().catch(() => {}); } catch(e) {}
        await ctx.reply(text, {
            parse_mode: "Markdown",
            ...keyboard
        });
    }
});

bot.action("tool_visual", async (ctx: any) => {
    ctx.session.step = 'idle';
    await handleVisualStart(ctx);
});

bot.action("tool_compile", async (ctx: any) => {
    ctx.session.step = 'idle';
    await handleCompileStart(ctx);
});

bot.action("me_info", async (ctx: any) => {
    ctx.session.step = 'idle';
    await handleMe(ctx);
});

bot.action("billing_info", async (ctx: any) => {
    ctx.session.step = 'idle';
    await handleBilling(ctx);
});

bot.action("visual_modify", async (ctx: any) => {
    ctx.session.step = 'collecting_visual_data';
    await ctx.answerCbQuery();
    await ctx.reply(`🔧 *Режим модификации*\n\nКонтекст сохранен. Присылайте дополнительные данные (текст, фото, файлы) или нажмите "Сгенерировать":`, {
        parse_mode: "Markdown",
        ...getVisualActionKeyboard()
    });
});

// ── Billing Actions ──
bot.action("billing_shop", ctx => handleBillingShop(ctx));
bot.action("billing_cat_chars", ctx => handleBillingCategory(ctx, 'chars'));
bot.action("billing_cat_reports", ctx => handleBillingCategory(ctx, 'reports'));
bot.action("billing_cat_combo", ctx => handleBillingCategory(ctx, 'combo'));
bot.action("billing_cat_all", ctx => handleBillingCategory(ctx, 'all'));
bot.action(/^billing_buy_(.+)$/, ctx => handleBillingBuy(ctx, ctx.match[1]));
bot.action(/^billing_confirm_(.+)$/, ctx => handleBillingConfirm(ctx, ctx.match[1]));
bot.action("billing_history", ctx => handleBillingHistory(ctx));
bot.action("billing_promo", ctx => handleBillingPromoStart(ctx));

bot.action("referral_main", async (ctx: any) => {
    ctx.session.step = 'idle';
    await handleReferral(ctx);
});

bot.action("tasks_active", async (ctx: any) => {
    ctx.session.step = 'idle';
    await handleActiveTasks(ctx);
});

bot.action(/^task_reset_(.+)$/, async (ctx: any) => {
    const sessionId = ctx.match[1];
    await handleTaskReset(ctx, sessionId);
});

bot.action(/^toggle_type_(.+)$/, async (ctx: any) => {
    const { handleVisualToggleType } = await import("./handlers/visual");
    await handleVisualToggleType(ctx);
});

bot.action("visual_generate_start", async (ctx: any) => {
    await ctx.answerCbQuery();
    const { getLangSelectionKeyboard } = await import("./keyboards/menu");
    const text = `🖥 *Выбор платформы выполнения*\n\nВыберите язык, на котором ИИ будет генерировать код визуализации:`;
    const keyboard = getLangSelectionKeyboard();

    try {
        await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
    } catch (e) {
        try { await ctx.deleteMessage().catch(() => {}); } catch(de) {}
        await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
    }
});

bot.action("visual_generate", ctx => handleVisualGenerateRequest(ctx));
bot.action("visual_reset", ctx => handleVisualReset(ctx));
bot.action("lang_python", ctx => handleVisualProcess(ctx, 'python'));
bot.action("lang_r", ctx => handleVisualProcess(ctx, 'r'));

// --- Missing handler: "noop" (used for pagination indicator) ---
bot.action("noop", async (ctx) => {
    await ctx.answerCbQuery();
});

// --- Missing handler: "settings_main" (from getMainMenu) ---
bot.action("settings_main", async (ctx: any) => {
    await ctx.answerCbQuery();
    const text = `⚙️ *Настройки*\n\nЗдесь вы можете управлять вашим аккаунтом и безопасностью.`;
    const { getSettingsMenu } = await import("./keyboards/menu");
    const keyboard = getSettingsMenu();

    try {
        await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
    } catch (e) {
        try { await ctx.deleteMessage().catch(() => {}); } catch(de) {}
        await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
    }
});

bot.action("security_main", async (ctx: any) => {
    await ctx.answerCbQuery("📡 Запрашиваю список сессий...");
    try {
        const res = await fetch(`${SITE_INTERNAL_URL}/api/internal/bot/session?telegramId=${ctx.from.id}`, {
            headers: { "X-Bot-Secret": WEBHOOK_SECRET }
        });
        const { sessions } = await res.json() as any;
        const { getSecurityMenu } = await import("./keyboards/menu");
        
        const countText = sessions.length === 1 ? "_У вас только одна активная сессия (вы)._" : `_Активных сессий: ${sessions.length}_`;
        const text = `🛡 *Безопасность и Сессии*\n\nЗдесь отображаются все устройства, имеющие доступ к вашему аккаунту Perricheno.\n\n${countText}`;
        const keyboard = getSecurityMenu(sessions || []);

        try {
            await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
        } catch (e) {
            try { await ctx.deleteMessage().catch(() => {}); } catch(de) {}
            await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
        }
    } catch (e) {
        await ctx.reply("⚠️ Ошибка при загрузке сессий.");
    }
});

bot.action("security_terminate_others", async (ctx: any) => {
    await ctx.answerCbQuery("🚫 Завершаю сеансы...");
    try {
        await fetch(`${SITE_INTERNAL_URL}/api/internal/bot/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET },
            body: JSON.stringify({ action: "terminate_others", telegramId: String(ctx.from.id) })
        });
        
        await ctx.reply("✅ *Все остальные сеансы завершены.*\n\nДругие устройства будут разлогинены при следующей активности.");
        
        // Refresh security view
        const res = await fetch(`${SITE_INTERNAL_URL}/api/internal/bot/session?telegramId=${ctx.from.id}`, {
            headers: { "X-Bot-Secret": WEBHOOK_SECRET }
        });
        const { sessions } = await res.json() as any;
        const { getSecurityMenu } = await import("./keyboards/menu");
        await ctx.editMessageText(`🛡 *Безопасность и Сессии*\n\n_Сеансы сброшены._`, {
            parse_mode: "Markdown",
            ...getSecurityMenu(sessions || [])
        }).catch(() => {});
    } catch (e) {
        await ctx.reply("⚠️ Не удалось завершить сеансы.");
    }
});

bot.action(/^history_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1]);
    await handleHistory(ctx, page);
});

bot.action(/^history_view_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleViewSession(ctx, ctx.match[1]);
});

bot.action(/^history_delete_(.+)$/, async (ctx) => {
    const sessionId = ctx.match[1];
    const { handleDeleteSession } = await import("./handlers/history");
    await handleDeleteSession(ctx, sessionId);
});

bot.action(/^dl_pdf_(.+)$/, async (ctx) => {
    await handleDownloadFile(ctx, ctx.match[1], "pdf");
});

bot.action(/^dl_zip_(.+)$/, async (ctx) => {
    await handleDownloadFile(ctx, ctx.match[1], "zip");
});

bot.action(/^dl_code_(.+)$/, async (ctx) => {
    await handleDownloadFile(ctx, ctx.match[1], "code");
});

bot.action(/^view_images_(.+)$/, async (ctx) => {
    await handleViewImages(ctx, ctx.match[1]);
});

// --- Message Handling (Conversational Flow) ---
bot.on(["text", "photo", "document"], async (ctx: any) => {
    const step = ctx.session.step;
    
    if (step === 'awaiting_visual_name') {
        return handleVisualName(ctx);
    } else if (step === 'collecting_visual_data') {
        return handleVisualCollect(ctx);
    } else if (step === 'awaiting_compile_file') {
        return handleCompileFile(ctx);
    } else if (step === 'promo_input' && ctx.message?.text) {
        return handleBillingPromoApply(ctx, ctx.message.text.trim());
    } else if (step === 'idle') {
        // Default behavior if not in a flow
        if (ctx.message.text?.startsWith('/')) return; // Ignore other commands
        await ctx.reply("👋 Чтобы начать, выберите *Визуализация* в меню.", { parse_mode: "Markdown", ...getMainMenu() });
    }
});

// --- Global Error Handler (The "Immortal" Guard) ---
bot.catch((err: any, ctx: any) => {
    // Ignore common harmless Telegram errors
    const desc = err.description || "";
    if (desc.includes("message is not modified")) return;
    if (desc.includes("query is too old")) return;
    if (desc.includes("message to edit not found")) return;
    
    console.error(`🔴 CRITICAL_BOT_ERROR [${ctx.updateType}]:`, err);
    
    // Attempt to notify user without crashing
    ctx.reply("⚠️ Временная заминка. Пожалуйста, попробуйте еще раз через минуту.").catch(() => {});
});

// --- Launch ---
async function main() {
    // 1. Setup Internal Server (Webhook + Internal Push API)
    const server = http.createServer(async (req, res) => {
        const url = req.url || "";
        
        // A. Telegram Webhook (Next.js Proxy path: /api/webhook/telegram)
        if (url.includes("/api/webhook/telegram")) {
            const secretToken = req.headers["x-telegram-bot-api-secret-token"];
            if (secretToken !== WEBHOOK_SECRET) {
                console.warn("⚠️ Received webhook with INVALID secret token");
                res.writeHead(403);
                return res.end("Forbidden");
            }
            console.log(`📥 Incoming Telegram Update: ${req.method} ${url}`);
            return bot.webhookCallback("/api/webhook/telegram")(req, res);
        }

        // B. Bot Internal API (Push updates from Next.js)
        if (url.startsWith("/bot-internal/")) {
            const secret = req.headers["x-bot-secret"];
            if (secret !== WEBHOOK_SECRET) {
                res.writeHead(403);
                return res.end("Unauthorized");
            }

            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async () => {
                try {
                    const data = JSON.parse(body);
                    const path = url.replace("/bot-internal/", "");
                    
                    if (path === "update-visual") {
                        const { chatId, messageId, text, language, statusData } = data;
                        
                        let draftText = "";
                        if (statusData) {
                            // Render Checklist
                            let checklist = "*⚡ Статус Генерации:*\n";
                            for (const step of statusData.steps || []) {
                                if (step.state === "done") checklist += `✅ ${step.text}\n`;
                                else if (step.state === "running") checklist += `🔄 ${step.text}...\n`;
                                else checklist += `⏳ ${step.text}\n`;
                            }
                            
                            // Render Logs
                            let logBlock = "\n*Логи сервера:*\n";
                            for (const log of statusData.logs || []) {
                                logBlock += `\`> ${log}\`\n`;
                            }

                            // Render Code
                            const codeBlock = statusData.code || "";
                            const displayCode = codeBlock.length > 500 ? "...\n" + codeBlock.slice(-500) : codeBlock;
                            
                            draftText = `${checklist}${logBlock}\n*Код:*\n\`\`\`${language}\n${displayCode || "Ожидание..."}\n\`\`\``;
                        } else {
                            const displayCode = text.length > 800 ? text.slice(0, 800) + "..." : text;
                            draftText = `⚙️ *Генерация кода...*\n\n\`\`\`${language}\n${displayCode}\n\`\`\`\n\n🕒 Пожалуйста, подождите...`;
                        }

                        // Применяем sendMessageDraft в качестве основного метода потоковой передачи (API 9.5)
                        // editMessageText остается как фолбек (fallback) для старых клиентов/ограничений
                        await bot.telegram.callApi("sendMessageDraft", {
                            chat_id: chatId,
                            text: draftText,
                            parse_mode: "Markdown"
                        }).catch(async (err: any) => {
                            // Если sendMessageDraft не поддерживается, падаем на классический editMessageText
                            await bot.telegram.editMessageText(chatId, messageId, undefined, draftText, { parse_mode: "Markdown" }).catch(() => {});
                        });
                    }

                    if (path === "send-message") {
                        const { userId, text } = data;
                        await bot.telegram.sendMessage(userId, text, { parse_mode: "Markdown" });
                    }

                    if (path === "complete-visual") {
                        const { chatId, messageId, sessionId } = data;
                        const { handleVisualCompletePush } = await import("./handlers/visual");
                        await handleVisualCompletePush(bot, chatId, messageId, sessionId);
                    }

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                } catch (err: any) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        // C. Health Check
        if (url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ status: "healthy" }));
        }

        res.writeHead(404);
        res.end();
    });

    server.listen(BOT_PORT, () => {
        console.log(`🤖 Internal Bot Server (Webhook + Push) listening on port ${BOT_PORT}`);
    });

    // 2. Register with Telegram (Always prioritize Fast Webhooks)
    const externalUrl = process.env.WEBHOOK_DOMAIN || process.env.WEBHOOK_URL;
    
    if (externalUrl) {
        const webhookUrl = `${externalUrl}/api/webhook/telegram`;
        await bot.telegram.setWebhook(webhookUrl, { secret_token: WEBHOOK_SECRET });
        console.log(`🚀 ВЕБХУК АКТИВИРОВАН: ${webhookUrl}`);
    } else {
        await bot.launch();
        console.log("🚀 Поллинг активирован (WEBHOOK_DOMAIN не найден)");
    }
}

main().catch(err => {
    console.error("🔴 ОШИБКА ЗАПУСКА БОТА:", err);
});

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
