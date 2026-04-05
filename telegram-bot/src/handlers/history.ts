import { Context, Markup } from "telegraf";
import { getMainMenu, getHistoryMenu } from "../keyboards/menu";
import { escapeMarkdown } from "../utils/format";

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

            const escapedTitle = escapeMarkdown(total > 0 ? "Ваша история" : "История пуста");
            const text = `📂 *${escapedTitle}* (${total} сессий)\n` +
                         `Страница ${page} из ${totalPages}\n\n` +
                         `Выберите отчет для просмотра деталей (на сайте):`;
            
            const historyKeyboard = getHistoryMenu(sessions, page, totalPages);
            
            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: "Markdown", ...historyKeyboard }).catch(() => {});
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

export async function handleViewSession(ctx: any, sessionId: string) {
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ sessionId }), // We'll update the API to handle this
        });

        if (res.ok) {
            const { session } = await res.json() as any;
            if (!session) return ctx.reply("❌ Сессия не найдена.");

            const date = new Date(session.created_at).toLocaleString();
            const text = `📄 *Детали сессии*\n\n` +
                         `📌 Название: *${escapeMarkdown(session.title)}*\n` +
                         `🆔 ID: \`${session.id}\`\n` +
                         `📅 Дата: \`${date}\`\n` +
                         `🚥 Статус: *${session.status === 'done' ? '✅ Завершено' : '⏳ В процессе'}*\n\n` +
                         `Выберите действие для получения файлов:`;
            
            const { getSessionDetailKeyboard } = await import("../keyboards/menu");
            const keyboard = getSessionDetailKeyboard(session.id, session.share_id);
            
            await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
        }
    } catch (err) {
        console.error(err);
        await ctx.reply("⚠️ Ошибка при загрузке деталей сессии.");
    }
}

export async function handleDownloadFile(ctx: any, sessionId: string, type: "zip" | "pdf" | "code") {
    await ctx.answerCbQuery(`🚀 Подготовка ${type.toUpperCase()}...`);
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/history/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ sessionId, type }),
        });

        if (res.ok) {
            const buffer = await res.arrayBuffer();
            let filename = `report_${sessionId.slice(0, 8)}.${type}`;
            if (type === "zip") filename = `project_${sessionId.slice(0, 8)}.zip`;
            if (type === "pdf") filename = `report_${sessionId.slice(0, 8)}.pdf`;
            if (type === "code") {
                // If code, we check the content disposition or guess
                const disp = res.headers.get("Content-Disposition");
                filename = disp?.split('filename=')[1]?.replace(/"/g, '') || `visual_${sessionId.slice(0, 8)}.py`;
            }
            
            await ctx.replyWithDocument({ source: Buffer.from(buffer), filename });
        } else {
            const data = await res.json() as any;
            await ctx.reply(`❌ ${data.error || "Не удалось загрузить файл."}`);
        }
    } catch (err) {
        console.error(err);
        await ctx.reply("⚠️ Ошибка при скачивании файла.");
    }
}

export async function handleViewImages(ctx: any, sessionId: string) {
    await ctx.answerCbQuery("🖼 Загрузка графиков...");
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/history/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ sessionId, type: "images" }),
        });

        if (res.ok) {
            const { visuals } = await res.json() as any;
            if (!visuals || visuals.length === 0) return ctx.reply("❌ В этой сессии нет сохраненных графиков.");

            // Telegram MediaGroup limit is 10 items
            const media: any[] = visuals.slice(0, 10).map((v: any, idx: number) => {
                const base64Data = v.image.replace(/^data:image\/\w+;base64,/, "");
                return {
                    type: 'photo',
                    media: { source: Buffer.from(base64Data, 'base64') },
                    caption: idx === 0 ? `📊 Графики сессии \`${sessionId.slice(0, 8)}\`` : undefined,
                    parse_mode: 'Markdown'
                };
            });

            await ctx.replyWithMediaGroup(media);
        }
    } catch (err) {
        console.error(err);
        await ctx.reply("⚠️ Ошибка при загрузке изображений.");
    }
}

export async function handleDeleteSession(ctx: any, sessionId: string) {
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/history?sessionId=${sessionId}`, {
            method: "DELETE",
            headers: { "X-Bot-Secret": WEBHOOK_SECRET! },
        });

        if (res.ok) {
            await ctx.answerCbQuery("🗑 Сессия успешно удалена!");
            // Return to history page 1
            await handleHistory(ctx, 1);
        } else {
            await ctx.answerCbQuery("❌ Ошибка при удалении.");
        }
    } catch (err) {
        console.error(err);
        await ctx.reply("⚠️ Ошибка связи с сервером при удалении.");
    }
}
