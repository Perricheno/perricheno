import { Telegraf } from "telegraf";
import { handleStart, handleMe } from "./handlers/auth";
import { handleVisualStart, handleVisualName, handleVisualCollect, handleVisualGenerateRequest, handleVisualProcess, handleVisualReset } from "./handlers/visual";
import { handleHistory, handleViewSession, handleDownloadFile, handleViewImages } from "./handlers/history";
import { handleBilling } from "./handlers/billing";
import { getMainMenu, getVisualSuggestionsKeyboard } from "./keyboards/menu";

import http from "http";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const BOT_PORT = process.env.BOT_PORT || 3001;

if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error("FATAL: Environment variables (BOT_TOKEN, WEBHOOK_SECRET) are not set.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- In-Memory Session Middleware ---
const sessionStore = new Map<number, any>();
bot.use(async (ctx: any, next: () => Promise<void>) => {
    const userId = ctx.from?.id;
    if (!userId) return next();
    
    if (!sessionStore.has(userId)) {
        sessionStore.set(userId, { step: 'idle', visual: { text: [], images: [], files: [], title: '', lang: 'python' } });
    }
    ctx.session = sessionStore.get(userId);
    return next();
});

// --- Commands ---
bot.start(ctx => handleStart(ctx));
bot.command("me", ctx => handleMe(ctx));
bot.command("history", ctx => handleHistory(ctx));
bot.command("billing", ctx => handleBilling(ctx));

// --- Actions (Callbacks) ---
bot.action("main_menu", async (ctx) => {
    await ctx.answerCbQuery();
    const text = `🏠 *Главное меню*`;
    const keyboard = getMainMenu();
    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
    } else {
        await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
    }
});

bot.action("tool_visual", async (ctx) => {
    await ctx.answerCbQuery();
    const text = `📊 *Визуализация данных*\n\nВыберите тип визуализации или создайте новый проект:`;
    const keyboard = getVisualSuggestionsKeyboard();
    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
    } else {
        await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
    }
});

bot.action("select_type_auto", ctx => handleVisualStart(ctx));
bot.action(/^select_type_(.+)$/, ctx => handleVisualStart(ctx));

bot.action("billing_info", ctx => handleBilling(ctx));
bot.action("me_info", ctx => handleMe(ctx));

bot.action("visual_generate", ctx => handleVisualGenerateRequest(ctx));
bot.action("visual_reset", ctx => handleVisualReset(ctx));
bot.action("lang_python", ctx => handleVisualProcess(ctx, 'python'));
bot.action("lang_r", ctx => handleVisualProcess(ctx, 'r'));

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

// --- Message Handling (Converational Flow) ---
bot.on(["text", "photo", "document"], async (ctx: any) => {
    const step = ctx.session.step;
    
    if (step === 'awaiting_visual_name') {
        return handleVisualName(ctx);
    } else if (step === 'collecting_visual_data') {
        return handleVisualCollect(ctx);
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
    // 1. Setup Internal Webhook Listener (for proxy from Next.js)
    const server = http.createServer(bot.webhookCallback(`/webhook/${BOT_TOKEN}`));
    server.listen(BOT_PORT, () => {
        console.log(`🤖 Internal Bot Server listening on port ${BOT_PORT}`);
    });

    // 2. Register with Telegram
    if (process.env.WEBHOOK_DOMAIN) {
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
