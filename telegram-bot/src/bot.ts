import { Telegraf, Context } from "telegraf";
import { handleStart, handleMe } from "./handlers/auth";
import { handleVisualStart, handleVisualName, handleVisualCollect, handleVisualGenerateRequest, handleVisualProcess, handleVisualReset, handleVisualToggleType, handleCompileStart, handleCompileFile } from "./handlers/visual";
import { handleHistory, handleViewSession, handleDownloadFile, handleViewImages } from "./handlers/history";
import { handleBilling, handleBillingShop, handleBillingCategory, handleBillingBuy, handleBillingConfirm, handleBillingHistory, handleBillingPromoStart, handleBillingPromoApply } from "./handlers/billing";
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
    await ctx.editMessageText(`🏠 *Главное меню*\n\nВыберите нужный инструмент:`, {
        parse_mode: "Markdown",
        ...getMainMenu()
    });
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

bot.action("visual_generate", ctx => handleVisualGenerateRequest(ctx));
bot.action("visual_reset", ctx => handleVisualReset(ctx));
bot.action("lang_python", ctx => handleVisualProcess(ctx, 'python'));
bot.action("lang_r", ctx => handleVisualProcess(ctx, 'r'));

// --- Missing handler: "noop" (used for pagination indicator) ---
bot.action("noop", async (ctx) => {
    await ctx.answerCbQuery();
});

// --- Missing handler: "settings_main" (from getMainMenu) ---
bot.action("settings_main", async (ctx) => {
    await ctx.answerCbQuery();
    const text = `⚙️ *Настройки*\n\nНастройки пока в разработке. Следите за обновлениями!`;
    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "« Назад", callback_data: "main_menu" }]]
            }
        }).catch(() => {});
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

// --- Errors ---
bot.catch((err: any, ctx: any) => {
    // Specifically ignore "message is not modified" errors as they are harmless (user clicked same button twice)
    if (err.description && err.description.includes("message is not modified")) {
        return;
    }
    console.error(`Bot Error for ${ctx.updateType}`, err);
});

// --- Launch ---
async function main() {
    // 1. Setup Internal Server (Webhook + Internal Push API)
    const server = http.createServer(async (req, res) => {
        const url = req.url || "";
        
        // A. Telegram Webhook
        if (url.startsWith(`/webhook/${BOT_TOKEN}`)) {
            return bot.webhookCallback(`/webhook/${BOT_TOKEN}`)(req, res);
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
                        const { chatId, messageId, text, language } = data;
                        const displayCode = text.length > 800 ? text.slice(0, 800) + "..." : text;
                        await bot.telegram.editMessageText(chatId, messageId, undefined, 
                            `⚙️ *Генерация кода...*\n\n\`\`\`${language}\n${displayCode}\n\`\`\`\n\n🕒 Пожалуйста, подождите...`, 
                            { parse_mode: "Markdown" }
                        ).catch(() => {});
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

        res.writeHead(404);
        res.end();
    });

    server.listen(BOT_PORT, () => {
        console.log(`🤖 Internal Bot Server (Webhook + Push) listening on port ${BOT_PORT}`);
    });

    // 2. Register with Telegram
    if (process.env.WEBHOOK_DOMAIN) {
        // Register webhook through Next.js proxy at /api/webhook/telegram
        // Next.js forwards requests to bot container at /webhook/<token>
        const webhookUrl = `${process.env.WEBHOOK_DOMAIN}/api/webhook/telegram`;
        await bot.telegram.setWebhook(webhookUrl, { secret_token: WEBHOOK_SECRET });
        console.log(`🚀 Bot registered Webhook: ${webhookUrl}`);
    } else {
        await bot.launch();
        console.log("🚀 Bot launched in POLLING mode (dev)");
    }
}

main().catch(err => console.error(err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
