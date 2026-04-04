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
    
    const msg = await ctx.reply(`🚀 *Запуск ИИ-генерации (${lang.toUpperCase()})...*\n\n📂 Обрабатываю загруженные файлы...`, {
        parse_mode: "Markdown"
    });

    try {
        const s = ctx.session.visual;
        
        // ── 1. Build text context from messages ──
        const textParts: string[] = [];
        if (s.text.length > 0) {
            textParts.push(`USER TEXT:\n${s.text.join('\n---\n')}`);
        }

        // ── 2. Download and extract text from files ──
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
                        // Send PDF to the site's extraction endpoint or read as buffer
                        const pdfBuffer = await res.arrayBuffer();
                        
                        // Try PDF text extraction via site API
                        try {
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
                                const { text } = await extractRes.json() as any;
                                if (text && text.length > 0) {
                                    // Limit to ~50K chars to avoid token overflow
                                    const trimmed = text.length > 50000 ? text.slice(0, 50000) + "\n...[TRUNCATED]" : text;
                                    textParts.push(`FILE "${fileName}":\n${trimmed}`);
                                }
                            } else {
                                // Fallback: just note the file was attached
                                textParts.push(`FILE "${fileName}": [PDF uploaded but text extraction failed — please generate based on available context]`);
                            }
                        } catch (e) {
                            textParts.push(`FILE "${fileName}": [PDF uploaded but extraction unavailable]`);
                        }
                    } else if (['txt', 'csv', 'tsv', 'json', 'md', 'tex', 'log', 'xml', 'r', 'py'].includes(ext || '')) {
                        // Text-based files: read directly
                        const fileText = await res.text();
                        const trimmed = fileText.length > 50000 ? fileText.slice(0, 50000) + "\n...[TRUNCATED]" : fileText;
                        textParts.push(`FILE "${fileName}":\n${trimmed}`);
                    } else {
                        textParts.push(`FILE "${fileName}": [Binary file attached, type: ${ext}]`);
                    }
                } catch (e) {
                    console.error(`Failed to download file ${file.fileName}:`, e);
                }
            }
        }

        // ── 3. Download images and add captions ──
        const imageDescriptions: string[] = [];
        if (s.images && s.images.length > 0) {
            for (const img of s.images) {
                if (img.caption) {
                    imageDescriptions.push(`IMAGE CAPTION: ${img.caption}`);
                }
                // Note: we don't send actual image data to the code generator, 
                // but captions give context about what data the user wants visualized
            }
            if (imageDescriptions.length > 0) {
                textParts.push(imageDescriptions.join('\n'));
            }
            textParts.push(`[${s.images.length} image(s) attached by user for reference]`);
        }

        const fullContext = `TITLE: ${s.title}\nTYPE: ${s.type}\n\n${textParts.join('\n\n---\n\n')}`;
        
        // Update status
        if (msg.message_id) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `🚀 *Запуск ИИ-генерации (${lang.toUpperCase()})...*\n\n📊 Контекст: ${s.text.length} сообщ., ${s.files?.length || 0} файлов, ${s.images?.length || 0} изображений\n\n🕒 Пожалуйста, подождите...`,
                { parse_mode: "Markdown" }
            ).catch(() => {});
        }

        const genRes = await fetch(`${SITE_URL}/api/internal/bot/visual/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ 
                context: { text_data: fullContext, files_text: '' }, 
                language: lang,
                telegramId: ctx.from.id,
                title: s.title,
                chartType: s.type || 'auto',
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
        // The generate route already compiled and saved everything to DB.
        // We just read the result and send it to Telegram.
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
                // Send compiled image
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
                
                // Send source code file
                const codeRes = await fetch(`${SITE_URL}/api/internal/bot/history/files`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                    body: JSON.stringify({ sessionId, type: "code" }),
                });
                if (codeRes.ok) {
                    const codeBuffer = await codeRes.arrayBuffer();
                    const disp = codeRes.headers.get("Content-Disposition");
                    const filename = disp?.split('filename=')[1]?.replace(/"/g, '') || 'visual.py';
                    await bot.telegram.sendDocument(chatId, { source: Buffer.from(codeBuffer), filename });
                }
            } else {
                // No visuals = compilation failed, check session error
                const errMsg = session?.error_msg || "Неизвестная ошибка среды выполнения.";
                await bot.telegram.sendMessage(chatId, `❌ *Ошибка компиляции:*\n\n\`\`\`\n${errMsg}\n\`\`\``, { 
                    parse_mode: "Markdown",
                    ...getPostVisualKeyboard()
                });
            }
        } else {
            await bot.telegram.sendMessage(chatId, `❌ Не удалось получить результат визуализации.`, {
                ...getPostVisualKeyboard()
            });
        }
    } catch (err: any) {
        console.error("Complete Push Error:", err);
        await bot.telegram.sendMessage(chatId, `⚠️ Ошибка при отправке результатов.`).catch(() => {});
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
