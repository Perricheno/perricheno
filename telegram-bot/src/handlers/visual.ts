import { Context, Markup } from "telegraf";
import { getMainMenu, getVisualSuggestionsKeyboard, getVisualActionKeyboard, getLangSelectionKeyboard, getPostVisualKeyboard } from "../keyboards/menu";
import { escapeMarkdown } from "../utils/format";
import { getSession, saveSession } from "../sessionStore";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Debounce timer for album collection
const collectionTimers = new Map<number, NodeJS.Timeout>();

export async function handleVisualStart(ctx: any) {
    const type = ctx.match?.[1] || 'auto';
    ctx.session.step = 'awaiting_visual_name';
    ctx.session.visual = {
        title: '',
        type: type === 'auto' ? ['auto'] : [type], 
        selectedTypes: type === 'auto' ? ['auto'] : [type],
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

    await ctx.reply(`✅ *Название установлено!* — \`${escapeMarkdown(name)}\`\n\nТеперь присылайте данные для визуализации (текст, фото или файлы):`, {
        parse_mode: "Markdown",
        ...getVisualActionKeyboard()
    });
}

export async function handleVisualCollect(ctx: any) {
    const s = ctx.session.visual;
    const userId = ctx.from.id;
    
    if (ctx.message.text) {
        s.text.push(ctx.message.text);
    } else if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1]; 
        s.images.push({ fileId: photo.file_id, caption: ctx.message.caption || "" });
    } else if (ctx.message.document) {
        s.files.push({ fileId: ctx.message.document.file_id, fileName: ctx.message.document.file_name });
    }

    // --- Logic for Debouncing Album Messages ---
    if (collectionTimers.has(userId)) {
        clearTimeout(collectionTimers.get(userId)!);
    }

    const timer = setTimeout(async () => {
        collectionTimers.delete(userId);
        const count = s.text.length + s.images.length + s.files.length;
        await ctx.reply(`➕ *Данные добавлены!*\n\nВсего элементов в контексте: \`${count}\`\nПрисылайте ещё или нажмите "Сгенерировать":`, {
            parse_mode: "Markdown",
            ...getVisualActionKeyboard()
        });
    }, 1000); // Wait 1 second for more media entries

    collectionTimers.set(userId, timer);
}

export async function handleVisualToggleType(ctx: any) {
    const type = ctx.match[1].toLowerCase();
    const s = ctx.session.visual;
    
    if (!s.selectedTypes) s.selectedTypes = [];
    
    if (s.selectedTypes.includes(type)) {
        s.selectedTypes = s.selectedTypes.filter((t: string) => t !== type);
    } else {
        s.selectedTypes.push(type);
    }
    
    const text = `📊 *Выбор визуализаций (Мульти-режим)*\n\nВыбрано: *${s.selectedTypes.length}*\n_${s.selectedTypes.map((t: string) => t.toUpperCase()).join(', ') || 'пусто'}_`;
    
    await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        ...getVisualSuggestionsKeyboard(s.selectedTypes)
    }).catch(() => {});
}

export async function handleVisualGenerateRequest(ctx: any) {
    if (ctx.session.isProcessing) return ctx.answerCbQuery("⏳ Пожалуйста, дождитесь завершения...");
    
    const s = ctx.session.visual;
    if (!s || (s.text.length === 0 && s.images.length === 0 && s.files.length === 0)) {
        await ctx.answerCbQuery("⚠️ Сначала добавьте данные!");
        return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(`📊 *Шаг 3: Выбор визуализаций*\n\nВыберите один или несколько типов графиков:`, {
        parse_mode: "Markdown",
        ...getVisualSuggestionsKeyboard(s.selectedTypes || [])
    }).catch(() => {});
}

export async function handleVisualProcess(ctx: any, lang: 'python' | 'r') {
    if (ctx.session.isProcessing) return ctx.answerCbQuery("⏳ Генерация уже запущена.");
    
    const s = ctx.session.visual;
    const types = s.selectedTypes?.length > 0 ? s.selectedTypes : ['auto'];
    
    ctx.session.visual.lang = lang;
    ctx.session.step = 'processing';
    ctx.session.isProcessing = true;
    
    const statusMsg = await ctx.reply(`🚀 *Запуск ИИ-генерации (${lang.toUpperCase()})...*\n\nКоличество графиков: *${types.length}*\n🕒 Обрабатываю...`, {
        parse_mode: "Markdown"
    });

    try {
        const textParts: string[] = [];
        const attachedFiles: { name: string, content_b64: string }[] = [];

        // ── 1. Download and extract text from files ──
        if (s.files && s.files.length > 0) {
            for (const file of s.files) {
                try {
                    const fileLink = await ctx.telegram.getFileLink(file.fileId);
                    const fileUrl = fileLink.href || fileLink.toString();
                    const fileName = file.fileName || 'unknown';
                    
                    const res = await fetch(fileUrl);
                    if (!res.ok) continue;
                    
                    const pdfBuffer = await res.arrayBuffer();
                    
                    // Always try extraction via site API
                    const extractRes = await fetch(`${SITE_URL}/api/internal/bot/extract-text`, {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/octet-stream",
                            "X-Bot-Secret": WEBHOOK_SECRET!,
                            "X-File-Name": fileName
                        },
                        body: pdfBuffer,
                        signal: AbortSignal.timeout(60000),
                    });
                    
                    if (extractRes.ok) {
                        const { text, images: extractedImages } = await extractRes.json() as any;
                        if (text && text.length > 0) {
                            textParts.push(`FILE "${fileName}":\n${text}`);
                            const fileNameBase = fileName.replace(/\.[^/.]+$/, "");
                            attachedFiles.push({
                                name: `${fileNameBase}.txt`,
                                content_b64: Buffer.from(text).toString('base64')
                            });
                        }
                        if (extractedImages && extractedImages.length > 0) {
                            ctx.session.visual.images.push(...extractedImages.map((img: string) => ({ base64: img })));
                        }
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

        // ── 3. Sequential Generation for all selected types ──
        const userPrompt = s.text.join('\n') || s.title;
        const fileDataContext = textParts.join('\n\n---\n\n');
        const visionImages = s.images.filter((img: any) => img.base64).map((img: any) => img.base64);

        for (let i = 0; i < types.length; i++) {
            const currentType = types[i];
            
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined,
                `🚀 *Генерация (${i + 1}/${types.length}): ${currentType.toUpperCase()}*\n\n📊 Визуальный контекст: ${visionImages.length} стр.\n\n🕒 Обрабатываю...`,
                { parse_mode: "Markdown" }
            ).catch(() => {});

            const genRes = await fetch(`${SITE_URL}/api/internal/bot/visual/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                body: JSON.stringify({ 
                    context: { text_data: fileDataContext }, 
                    instruction: userPrompt,
                    language: lang,
                    telegramId: ctx.from.id,
                    title: s.title,
                    chartType: currentType,
                    chatId: ctx.chat.id,
                    messageId: statusMsg.message_id,
                    images: visionImages,
                    attachedFiles: attachedFiles // Passes actual data files to compiler
                }),
            });

            if (!genRes.ok) {
                const errBody = await genRes.text().catch(() => 'Unknown error');
                console.error(`Error for type ${currentType}:`, errBody);
                // Continue with next instead of failing entire session if one fails?
            }
        }

    } catch (err: any) {
        console.error("Visual Error:", err);
        await ctx.reply(`⚠️ Критическая ошибка: ${err.message}`);
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
        // Reset processing state for the user
        try {
            const userSess = await getSession(chatId);
            userSess.step = 'idle';
            userSess.isProcessing = false;
            await saveSession(chatId, userSess);
        } catch (e) {
            console.error("Failed to reset session in complete push:", e);
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

export async function handleCompileStart(ctx: any) {
    ctx.session.step = 'awaiting_compile_file';
    // Clear visual context to avoid state contamination
    ctx.session.visual = { text: [], images: [], files: [], title: '', lang: 'python' };
    await ctx.answerCbQuery();
    await ctx.reply("🚀 *Режим прямой компиляции*\n\nПришлите файл `.py` или `.r` для выполнения кода.\n\n_Бот автоматически распознает язык и вернет результат (график или логи)._", {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [[{ text: "« Отмена", callback_data: "main_menu" }]]
        }
    });
}

export async function handleCompileFile(ctx: any) {
    if (ctx.session.isProcessing) return;
    const doc = ctx.message.document;
    if (!doc) return;

    const fileName = doc.file_name || "";
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext !== 'py' && ext !== 'r') {
        return ctx.reply("⚠️ Пожалуйста, пришлите файл с расширением `.py` (Python) или `.r` (R).");
    }

    const statusMsg = await ctx.reply(`⏳ Обработка ${fileName}...`, { parse_mode: "Markdown" });
    ctx.session.isProcessing = true;

    try {
        const fileLink = await ctx.telegram.getFileLink(doc.file_id);
        const fileRes = await fetch(fileLink.href);
        const code = await fileRes.text();

        if (!code) throw new Error("Не удалось прочитать содержимое файла.");

        const isPython = ext === 'py';
        const runtime = isPython ? 'python' : 'r';
        const apiUrl = `${SITE_URL}/api/internal/bot/compile`;

        // 2. Call the internal billing-aware compiler proxy
        const compileRes = await fetch(apiUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-Bot-Secret": WEBHOOK_SECRET! 
            },
            body: JSON.stringify({ 
                code, 
                type: runtime, 
                telegramId: ctx.from.id 
            }),
            signal: AbortSignal.timeout(45000)
        });

        if (!compileRes.ok) {
            const errBody = await compileRes.json().catch(() => ({ error: "Ошибка компилятора" })) as any;
            throw new Error(errBody.error || "Ошибка соединения с компилятором.");
        }

        const result = await compileRes.json() as any;

        if (result.success) {
            if (result.image) {
                const buffer = Buffer.from(result.image, 'base64');
                await ctx.replyWithPhoto({ source: buffer }, {
                    caption: `✅ *Выполнение завершено!*\n\nФайл: \`${fileName}\`\nЯзык: *${runtime.toUpperCase()}*`,
                    parse_mode: "Markdown",
                    reply_markup: { inline_keyboard: [[{ text: "🏠 Меню", callback_data: "main_menu" }]] }
                });
            } else {
                const log = result.log || "Код выполнен успешно (нет вывода).";
                const cleanLog = log.length > 2000 ? log.slice(0, 2000) + "..." : log;
                await ctx.reply(`✅ *Выполнение завершено!*\n\n*Лог:* \n\`\`\`\n${cleanLog}\n\`\`\``, {
                    parse_mode: "Markdown",
                    reply_markup: { inline_keyboard: [[{ text: "🏠 Меню", callback_data: "main_menu" }]] }
                });
            }
        } else {
            const errorLog = result.log || "Неизвестная ошибка компиляции.";
            const cleanError = errorLog.length > 2000 ? errorLog.slice(0, 2000) + "..." : errorLog;
            await ctx.reply(`❌ *Ошибка выполнения:* \n\n\`\`\`\n${cleanError}\n\`\`\``, {
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "🏠 Назад", callback_data: "tool_compile" }]] }
            });
        }
    } catch (err: any) {
        console.error("Compile handler error:", err);
        await ctx.reply(`⚠️ Ошибка: ${err.message}`);
    } finally {
        ctx.session.isProcessing = false;
        ctx.session.step = 'idle';
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    }
}
