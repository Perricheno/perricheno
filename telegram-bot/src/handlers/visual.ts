import { getMainMenu, getVisualSuggestionsKeyboard, getVisualActionKeyboard, getLangSelectionKeyboard, getPostVisualKeyboard } from "../keyboards/menu";
import { sessionStore } from "../sessionStore";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleVisualStart(ctx: any) {
    const type = ctx.match?.[1] || 'auto';
    ctx.session.step = 'awaiting_visual_name';
    ctx.session.visual = {
        title: '',
        type: type,
        text: [],
        images: [],
        files: [],
        lang: 'python'
    };

    await ctx.answerCbQuery();
    await ctx.reply(`✍️ *Шаг 1: Название проекта*\n\nПожалуйста, введите название (например: "Анализ рынка 2024").\n\n_Выбранный тип: ${type.toUpperCase()}_`, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [[{ text: "❌ Отмена", callback_data: "visual_reset" }]]
        }
    });
}

export async function handleVisualName(ctx: any) {
    const name = ctx.message.text;
    if (!name || name.length < 3) {
        return ctx.reply("⚠️ Слишком короткое название. Попробуйте еще раз:");
    }

    ctx.session.visual.title = name;
    ctx.session.step = 'collecting_visual_data';

    await ctx.reply(`📂 *Шаг 2: Сбор данных для "${name}"*\n\nПрисылайте ТЕКСТ, ФОТО или ФАЙЛЫ, которые ИИ должен проанализировать.\n\nКогда закончите, нажмите кнопку ниже:`, {
        parse_mode: "Markdown",
        ...getVisualActionKeyboard()
    });
}

export async function handleVisualCollect(ctx: any) {
    const s = ctx.session.visual;
    
    if (ctx.message.text) {
        s.text.push(ctx.message.text);
    } else if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Use last element (highest resolution) without mutating array
        s.images.push({ fileId: photo.file_id, caption: ctx.message.caption || "" });
    } else if (ctx.message.document) {
        s.files.push({ fileId: ctx.message.document.file_id, fileName: ctx.message.document.file_name });
    }

    const count = s.text.length + s.images.length + s.files.length;
    await ctx.reply(`➕ Данные добавлены! (Всего элементов: ${count})\nПрисылайте еще или нажмите "Сгенерировать".`, {
        ...getVisualActionKeyboard()
    });
}

export async function handleVisualGenerateRequest(ctx: any) {
    if (ctx.session.isProcessing) return ctx.answerCbQuery("⏳ Пожалуйста, дождитесь завершения...");
    
    const s = ctx.session.visual;
    if (!s || (s.text.length === 0 && s.images.length === 0 && s.files.length === 0)) {
        return ctx.answerCbQuery("⚠️ Сначала добавьте данные!");
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText("⚙️ *Выберите язык программирования для графиков:*", {
        parse_mode: "Markdown",
        ...getLangSelectionKeyboard()
    }).catch(() => {});
}

export async function handleVisualProcess(ctx: any, lang: 'python' | 'r') {
    if (ctx.session.isProcessing) return ctx.answerCbQuery("⏳ Генерация уже запущена.");
    
    ctx.session.visual.lang = lang;
    ctx.session.step = 'processing';
    ctx.session.isProcessing = true;
    
    const msg = await ctx.reply(`🚀 *Запуск ИИ-генерации (${lang.toUpperCase()})...*\n\nПожалуйста, подождите, это может занять до 1 минуты.`, {
        parse_mode: "Markdown"
    });

    try {
        const s = ctx.session.visual;
        const contextText = `TITLE: ${s.title}\nTYPE: ${s.type}\nTEXTS: ${s.text.join('\n---\n')}`;
        
        const genRes = await fetch(`${SITE_URL}/api/internal/bot/visual/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ 
                context: { text_data: contextText }, 
                language: lang,
                telegramId: ctx.from.id,
                title: s.title,
                chatId: ctx.chat.id,
                messageId: msg.message_id
            }),
        });

        if (!genRes.ok) {
            const errBody = await genRes.text().catch(() => 'Unknown error');
            console.error(`Generate API Error ${genRes.status}:`, errBody);
            throw new Error(`Сервер вернул ошибку (${genRes.status}): ${errBody.slice(0, 200)}`);
        }

    } catch (err: any) {
        console.error(err);
        await ctx.reply(`⚠️ Ошибка: ${err.message}`);
        ctx.session.step = 'idle';
        ctx.session.isProcessing = false;
    }
}

export async function handleVisualCompletePush(bot: any, chatId: number, messageId: number, sessionId: string) {
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ sessionId }),
        });

        const { session } = await res.json() as any;
        if (!session) return;

        const finalCode = session.stream_text || session.main_tex;
        if (!finalCode) return;
        
        // Detect language from the actual code, not main_tex
        const lang = finalCode.includes("import ") || finalCode.includes("plt.") ? 'python' : 'r';

        await bot.telegram.editMessageText(chatId, messageId, undefined, 
            `✅ *Код готов!*\n\n🔄 Запускаю компиляцию в среде ${lang}...`, 
            { parse_mode: "Markdown" }
        ).catch(() => {});

        const compRes = await fetch(`${SITE_URL}/api/internal/bot/visual/compile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ code: finalCode, language: lang }),
        });

        const compResult = await compRes.json() as any;

        if (compResult.success && compResult.image) {
            // Save compiled results back to the session DB so history/files can serve them
            try {
                const visualEntry = JSON.stringify([{
                    chart_type: "auto",
                    language: lang,
                    image: `data:image/png;base64,${compResult.image}`,
                    source_code: finalCode
                }]);
                await fetch(`${SITE_URL}/api/internal/bot/history`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                    body: JSON.stringify({ sessionId, updateVisuals: visualEntry }),
                }).catch(() => {});
            } catch (e) { console.error("Failed to save visuals back to DB:", e); }
            
            const buffer = Buffer.from(compResult.image, 'base64');
            await bot.telegram.sendPhoto(chatId, { source: buffer }, {
                caption: `✅ *Визуализация готова!*\n\nПроект: *${session.title}*\n\nНиже прикреплен файл с исходным кодом.`,
                parse_mode: "Markdown",
                ...getPostVisualKeyboard()
            });
            
            const filename = lang === 'python' ? 'visual.py' : 'visual.R';
            await bot.telegram.sendDocument(chatId, { source: Buffer.from(finalCode), filename });
        } else {
            const errorLog = compResult.log || "Неизвестная ошибка среды выполнения.";
            await bot.telegram.sendMessage(chatId, `❌ *Ошибка компиляции:*\n\n\`\`\`\n${errorLog}\n\`\`\``, { 
                parse_mode: "Markdown",
                ...getPostVisualKeyboard()
            });
        }
    } catch (err: any) {
        console.error("Complete Push Error:", err);
    } finally {
        // FIX: Use the actual exported sessionStore instead of (global as any).sessionStore
        for (const [uid, sess] of sessionStore) {
            if (uid === chatId || sess.visual?.chatId === chatId) {
                sess.step = 'idle';
                sess.isProcessing = false;
            }
        }
    }
}

export async function handleVisualReset(ctx: any) {
    ctx.session.step = 'idle';
    ctx.session.isProcessing = false;
    ctx.session.visual = { text: [], images: [], files: [], title: '', lang: 'python' };
    await ctx.answerCbQuery();
    await ctx.reply("🧹 Контекст очищен. Возвращаюсь в главное меню.", { ...getMainMenu() });
}
