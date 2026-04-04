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
        
        // 1. Generate Code
        const genRes = await fetch(`${SITE_URL}/api/internal/bot/visual/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ context: { text_data: contextText }, language: lang }),
        });

        if (!genRes.ok) throw new Error("AI Generation failed");
        const { code } = await genRes.json() as { code: string };

        // 2. Stream code (simulation/update)
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 
            `✅ *Код сгенерирован!*\n\n\`\`\`${lang}\n${code.slice(0, 500)}${code.length > 500 ? '...' : ''}\n\`\`\`\n\n🔄 Компилирую и создаю изображение...`, 
            { parse_mode: "Markdown" }
        ).catch(() => {});

        // 3. Compile
        const compRes = await fetch(`${SITE_URL}/api/internal/bot/visual/compile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
            body: JSON.stringify({ code, language: lang }),
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
            await ctx.replyWithDocument({ source: Buffer.from(code), filename });
        } else {
            await ctx.reply(`❌ *Ошибка компиляции:*\n\n\`\`\`\n${compResult.log || "Неизвестная ошибка"}\n\`\`\``, { 
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
