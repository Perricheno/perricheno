import { Markup } from "telegraf";
import { escapeMarkdown } from "../utils/format";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleActiveTasks(ctx: any) {
    const tgUser = ctx.from;

    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ telegram_id: String(tgUser.id) }),
        });

        if (res.ok) {
            const { tasks } = await res.json() as any;
            
            let text = `⌛ *Активные задачи*\n\n` +
                       `Здесь отображаются процессы генерации, выполняемые в данный момент.\n\n`;

            if (!tasks || tasks.length === 0) {
                text += `_У вас нет активных задач. Все процессы завершены или свободны._`;
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback("🔄 Обновить", "tasks_active")],
                    [Markup.button.callback("« Назад", "main_menu")]
                ]);
                return ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
            }

            const buttons = [];
            for (const task of tasks) {
                const statusIcon = task.status === 'generating' ? '⚙️' : '📄';
                text += `${statusIcon} *${escapeMarkdown(task.title)}*\n` +
                        `└ Статус: \`${task.status}\` (${task.timeAgo} мин. назад)\n\n`;
                
                buttons.push([Markup.button.callback(`🚫 Сбросить: ${task.title.slice(0, 15)}...`, `task_reset_${task.id}`)]);
            }

            buttons.push([Markup.button.callback("🔄 Обновить список", "tasks_active")]);
            buttons.push([Markup.button.callback("« Назад", "main_menu")]);

            if (ctx.callbackQuery) {
                await ctx.editMessageText(text, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) }).catch(() => {});
            } else {
                await ctx.reply(text, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
            }
        }
    } catch (err) {
        console.error("Tasks handler error:", err);
        await ctx.reply("⚠️ Ошибка при загрузке активных задач.");
    }
}

export async function handleTaskReset(ctx: any, sessionId: string) {
    await ctx.answerCbQuery("⏳ Сбрасываю задачу...");
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ 
                telegram_id: String(ctx.from.id), 
                action: "reset", 
                sessionId 
            }),
        });

        if (res.ok) {
            await ctx.reply(`✅ *Задача сброшена.*\n\nЛимиты разблокированы. Вы можете начать новую визуализацию или отчет.`);
            await handleActiveTasks(ctx);
        }
    } catch (err) {
        await ctx.reply("⚠️ Не удалось сбросить задачу.");
    }
}
