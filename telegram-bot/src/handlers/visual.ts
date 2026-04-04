import { getMainMenu, getVisualSuggestionsKeyboard, getVisualActionKeyboard, getLangSelectionKeyboard, getPostVisualKeyboard } from "../keyboards/menu";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function handleVisualStart(ctx: any) {
    ctx.session.step = 'awaiting_visual_name';
    ctx.session.visual = { text: [], images: [], files: [], title: '', lang: 'python' };
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`📂 *Новая визуализация*\n\nПожалуйста, введите название для этого проекта (например: "Отчет по продажам 2024"):`, {
        parse_mode: "Markdown"
    }).catch(() => {});
}

export async function handleVisualName(ctx: any) {
    const name = ctx.message.text;
    ctx.session.visual.title = name;
    ctx.session.step = 'collecting_visual_data';
    
    await ctx.reply(`✅ Название принято: *${name}*\n\nТеперь присылайте контекст для визуализации. Я принимаю:\n• 📝 Текст\n• 🖼 Фотографии (с описанием)\n• 📄 Файлы (CSV, Excel, TXT)\n\nКогда закончите, нажмите кнопку *Сгенерировать*.`, {
        parse_mode: "Markdown",
        ...getVisualActionKeyboard()
    });
}

export async function handleVisualCollect(ctx: any) {
    const s = ctx.session.visual;
    
    if (ctx.message.text) {
        s.text.push(ctx.message.text);
    } else if (ctx.message.photo) {
        const photo = ctx.message.photo.pop();
        const fileId = photo.file_id;
        const caption = ctx.message.caption || "";
        s.images.push({ fileId, caption });
    } else if (ctx.message.document) {
        const doc = ctx.message.document;
        s.files.push({ fileId: doc.file_id, fileName: doc.file_name });
    }

    // Quiet acknowledgement (optional)
    // await ctx.reply("📥 Получено. Продолжайте или нажмите Сгенерировать.");
}

export async function handleVisualGenerateRequest(ctx: any) {
    await ctx.answerCbQuery();
    const s = ctx.session.visual;
    
    if (s.text.length === 0 && s.images.length === 0 && s.files.length === 0) {
        return ctx.reply("❌ Вы не предоставили никаких данных для визуализации. Пришлите текст или файлы!");
    }

    await ctx.reply(`📊 *Последний шаг*\n\nНа каком языке программирования сгенерировать код и визуализацию?`, {
        parse_mode: "Markdown",
        ...getLangSelectionKeyboard()
    });
}

export async function handleVisualProcess(ctx: any, lang: 'python' | 'r') {
    await ctx.answerCbQuery();
    ctx.session.visual.lang = lang;
    ctx.session.step = 'processing';
    
    const msg = await ctx.reply(`⚙️ *Запуск генерации...* (Язык: ${lang === 'python' ? 'Python' : 'R'})\n\n⏳ Анализирую контекст и пишу код...`, { parse_mode: "Markdown" });

    try {
        const s = ctx.session.visual;
        const contextText = `TITLE: ${s.title}\nTEXTS: ${s.text.join('\n---\n')}\nIMAGES: ${s.images.map((i: any) => i.caption).join(', ')}`;
        
        // 1. Start Generation
        const genRes = await fetch(`${SITE_URL}/api/internal/bot/visual/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ 
                context: { text_data: contextText }, 
                language: lang,
                telegramId: ctx.from.id,
                title: s.title
            }),
        });

        if (!genRes.ok) throw new Error("AI Generation start failed");
        const { sessionId } = await genRes.json() as { sessionId: string };

        // 2. Polling for stream_text
        let isDone = false;
        let finalCode = "";
        let lastStreamText = "";
        const startTime = Date.now();
        const timeout = 120000; // 2 minutes

        while (!isDone && (Date.now() - startTime < timeout)) {
            await new Promise(r => setTimeout(r, 2500)); // Poll every 2.5s to respect TG limits
            
            const pollRes = await fetch(`${SITE_URL}/api/internal/bot/history`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                body: JSON.stringify({ sessionId }),
            });

            if (pollRes.ok) {
                const { session } = await pollRes.json() as any;
                if (!session) break;

                if (session.stream_text && session.stream_text !== lastStreamText) {
                    lastStreamText = session.stream_text;
                    const displayCode = lastStreamText.length > 500 ? lastStreamText.slice(0, 500) + "..." : lastStreamText;
                    
                    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 
                        `⚙️ *Генерация кода...*\n\n\`\`\`${lang}\n${displayCode}\n\`\`\`\n\n🕒 Пожалуйста, подождите...`, 
                        { parse_mode: "Markdown" }
                    ).catch(() => {});
                }

                if (session.status === 'done') {
                    isDone = true;
                    finalCode = session.stream_text;
                } else if (session.status === 'error') {
                    throw new Error("AI Generation reported an error");
                }
            }
        }

        if (!finalCode) throw new Error("Generation timed out or failed");

        // 3. Compile
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 
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
            const buffer = Buffer.from(compResult.image, 'base64');
            await ctx.replyWithPhoto({ source: buffer }, {
                caption: `✅ *Визуализация готова!*\n\nПроект: *${s.title}*\n\nНиже прикреплен файл с исходным кодом.`,
                parse_mode: "Markdown",
                ...getPostVisualKeyboard()
            });
            
            const filename = lang === 'python' ? 'visual.py' : 'visual.R';
            await ctx.replyWithDocument({ source: Buffer.from(finalCode), filename });
        } else {
            const errorLog = compResult.log || "Неизвестная ошибка среды выполнения.";
            await ctx.reply(`❌ *Ошибка компиляции:*\n\n\`\`\`\n${errorLog}\n\`\`\``, { 
                parse_mode: "Markdown",
                ...getPostVisualKeyboard()
            });
        }

    } catch (err: any) {
        console.error(err);
        await ctx.reply(`⚠️ Произошла ошибка: ${err.message}`);
    } finally {
        ctx.session.step = 'idle';
    }
}

export async function handleVisualReset(ctx: any) {
    ctx.session.step = 'idle';
    ctx.session.visual = { text: [], images: [], files: [], title: '', lang: 'python' };
    await ctx.answerCbQuery();
    await ctx.reply("🧹 Контекст очищен. Возвращаюсь в главное меню.", { ...getMainMenu() });
}
