import { Telegraf } from "telegraf";
import { handleStart, handleMe } from "./handlers/auth";
import { handleVisualRequest } from "./handlers/visual";
import { handleHistory } from "./handlers/history";
import { getMainMenu, getVisualMenu } from "./keyboards/menu";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error("FATAL: Environment variables (BOT_TOKEN, WEBHOOK_SECRET) are not set.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- Commands ---
bot.start(ctx => handleStart(ctx));
bot.command("me", ctx => handleMe(ctx));
bot.command("history", ctx => handleHistory(ctx));

// --- Callbacks (Inline Logic) ---
bot.action("main_menu", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🏠 *Главное меню*`, {
        parse_mode: "Markdown",
        ...getMainMenu()
    });
});

bot.action("tool_visual", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(`📊 *Визуализация данных*\n\nНапишите запрос текстом (например: "сделай график доходов") или выберите тип:`, {
        parse_mode: "Markdown",
        ...getVisualMenu()
    });
});

bot.action("me_info", async (ctx) => {
    await ctx.answerCbQuery();
    await handleMe(ctx);
});

bot.action(/^history_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1]);
    await handleHistory(ctx, page);
});

// --- Text Handling (AI Visuals) ---
bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    // If it looks like a visualization request or is in "visual mode"
    if (text.toLowerCase().includes("график") || text.toLowerCase().includes("диаграмм") || text.length > 10) {
        return handleVisualRequest(ctx);
    }
});

// --- Errors ---
bot.catch((err: any, ctx: any) => {
    console.error(`Bot Error for ${ctx.updateType}`, err);
});

// --- Launch ---
async function main() {
    // Check if webhook is intended (production)
    if (process.env.WEBHOOK_DOMAIN) {
        const webhookUrl = `${process.env.WEBHOOK_DOMAIN}/api/webhook/telegram`;
        await bot.telegram.setWebhook(webhookUrl, { secret_token: WEBHOOK_SECRET });
        console.log(`🚀 Bot launched in WEBHOOK mode: ${webhookUrl}`);
    } else {
        await bot.launch();
        console.log("🚀 Bot launched in POLLING mode (dev)");
    }
}

main().catch(err => console.error(err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
