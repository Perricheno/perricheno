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
        const photo = ctx.message.photo[ctx.message.photo.length - 1]; 
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
    
    const msg = await ctx.reply(`🚀 *Запуск ИИ-генерации (${lang.toUpperCase()})...*\n\n📂 Обрабатываю загруженные файлы...`, {
        parse_mode: "Markdown"
    });

    try {
        const s = ctx.session.visual;
        const textParts: string[] = [];

        // ── 1. Download and extract text from files ──
        if (s.files && s.files.length > 0) {
            for (const file of s.files) {
                try {
                    const fileLink = await ctx.telegram.getFileLink(file.fileId);
                    const fileUrl = fileLink.href || fileLink.toString();
                    const fileName = file.fileName || 'unknown';
                    
                    const res = await fetch(fileUrl);
                    if (!res.ok) continue;
                    
                    const ext = fileName.split('.').pop()?.toLowerCase();
                    
                    if (ext === 'pdf') {
                        const pdfBuffer = await res.arrayBuffer();
                        const extractRes = await fetch(`${SITE_URL}/api/internal/bot/extract-text`, {
                            method: "POST",
                            headers: { 
                                "Content-Type": "application/octet-stream",
                                "X-Bot-Secret": WEBHOOK_SECRET!,
                                "X-File-Name": fileName
                            },
                            body: pdfBuffer,
                            signal: AbortSignal.timeout(30000),
                        });
                        
                        if (extractRes.ok) {
                            const { text, images: extractedImages } = await extractRes.json() as any;
                            if (text && text.length > 0) {
                                textParts.push(`FILE "${fileName}":\n${text}`);
                            }
                            if (extractedImages && extractedImages.length > 0) {
                                ctx.session.visual.images.push(...extractedImages.map((img: string) => ({ base64: img })));
                            }
                        } else {
                            textParts.push(`FILE "${fileName}": [PDF uploaded but text extraction failed]`);
                        }
                    } else if (['txt', 'csv', 'tsv', 'json', 'md', 'tex', 'log', 'xml', 'r', 'py'].includes(ext || '')) {
                        const fileText = await res.text();
                        textParts.push(`FILE "${fileName}":\n${fileText}`);
                    }
                } catch (e) {
                    console.error(`Failed to process file ${file.fileName}:`, e);
                }
            }
        }

        // ── 2. Download direct photos ──
        if (s.images && s.images.length > 0) {
            for (const imgObj of s.images) {
                if (imgObj.fileId && !imgObj.base64) {
                    try {
                        const fileLink = await ctx.telegram.getFileLink(imgObj.fileId);
                        const res = await fetch(fileLink.href);
                        if (res.ok) {
                            const buf = await res.arrayBuffer();
                            imgObj.base64 = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
                        }
                    } catch (e) {
                        console.error("Failed to download direct photo:", e);
                    }
                }
                if (imgObj.caption) {
                    textParts.push(`IMAGE CAPTION: ${imgObj.caption}`);
                }
            }
        }

        // ── 3. Final Context Separation ──
        const userPrompt = s.text.join('\n') || s.title;
        const fileDataContext = textParts.join('\n\n---\n\n');
        const visionImages = s.images.filter((img: any) => img.base64).map((img: any) => img.base64);
        
        if (msg.message_id) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `🚀 *Запуск ИИ-анализа (${lang.toUpperCase()})...*\n\n📊 Визуальный контекст: ${visionImages.length} стр.\n📝 Текстовый контекст: ${fileDataContext.length} симв.\n\n🕒 Обрабатываю...`,
                { parse_mode: "Markdown" }
            ).catch(() => {});
        }

        const genRes = await fetch(`${SITE_URL}/api/internal/bot/visual/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ 
                context: { text_data: fileDataContext }, 
                instruction: userPrompt,
                language: lang,
                telegramId: ctx.from.id,
                title: s.title,
                chartType: s.type || 'auto',
                chatId: ctx.chat.id,
                messageId: msg.message_id,
                images: visionImages
            }),
        });

        if (!genRes.ok) {
            const errBody = await genRes.text().catch(() => 'Unknown error');
            throw new Error(`Сервер (${genRes.status}): ${errBody.slice(0, 100)}`);
        }

    } catch (err: any) {
        console.error("Visual Error:", err);
        await ctx.reply(`⚠️ Ошибка: ${err.message}`);
        ctx.session.step = 'idle';
        ctx.session.isProcessing = false;
    }
}

export async function handleVisualCompletePush(bot: any, chatId: number, messageId: number, sessionId: string) {
    try {
        const res = await fetch(`${SITE_URL}/api/internal/bot/history/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ sessionId, type: "images" }),
        });

        const historyRes = await fetch(`${SITE_URL}/api/internal/bot/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ sessionId }),
        });
        const { session } = await historyRes.json() as any;

        if (res.ok) {
            const { visuals } = await res.json() as any;
            if (visuals && visuals.length > 0) {
                for (const v of visuals) {
                    if (v.image) {
                        const base64Data = v.image.replace(/^data:image\/\w+;base64,/, "");
                        const buffer = Buffer.from(base64Data, 'base64');
                        await bot.telegram.sendPhoto(chatId, { source: buffer }, {
                            caption: `✅ *Визуализация готова!*\n\nПроект: *${session?.title || 'Visual'}*\n\nНиже прикреплен файл с исходным кодом.`,
                            parse_mode: "Markdown",
                            ...getPostVisualKeyboard()
                        });
                    }
                }
                const codeRes = await fetch(`${SITE_URL}/api/internal/bot/history/files`, {
                    method: "POST", headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                    body: JSON.stringify({ sessionId, type: "code" }),
                });
                if (codeRes.ok) {
                    const codeBuffer = await codeRes.arrayBuffer();
                    const disp = codeRes.headers.get("Content-Disposition");
                    const filename = disp?.split('filename=')[1]?.replace(/"/g, '') || 'visual.py';
                    await bot.telegram.sendDocument(chatId, { source: Buffer.from(codeBuffer), filename });
                }
            } else {
                const errMsg = session?.error_msg || "Сбой компиляции.";
                await bot.telegram.sendMessage(chatId, `❌ *Ошибка:* \n\`${errMsg}\``, { parse_mode: "Markdown", ...getPostVisualKeyboard() });
            }
        }
    } catch (err: any) {
        console.error("Complete Push Error:", err);
    } finally {
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
