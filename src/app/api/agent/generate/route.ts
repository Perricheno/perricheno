import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { createAgentSession, updateAgentSession, getAgentSession, checkAndDeductUsage, getActiveAgentSessionsCount, sendTelegramNotification, updateTelegramNotification, toggleAgentSessionShare, getUserById } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Increase body size limit — rImages base64 payloads can be very large
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ── Settings type ──
interface GenerateSettings {
    prompt: string;
    type: string;
    useTemplate: boolean;
    style: 'simple' | 'medium' | 'phd';
    wordCount: number;
    columns: 1 | 2;
    useReferences: boolean;
    language: 'en' | 'ru';
    authorName?: string;
    courseName?: string;
    dateStr?: string;
    groupName?: string;
    supervisorName?: string;
    // Context fields
    taskDescription?: string;
    taskFileText?: string;
    referenceLinks?: string[];
    referenceFilesText?: string[];
    // For edits/fixes/visuals
    currentTex?: string;
    currentBib?: string;
    errorLog?: string;
    visuals?: { image: string, chart_type: string, code: string, language: string }[];
    useDbImages?: boolean;
}

function buildSystemPrompt(s: GenerateSettings): string {
    const isRussian = s.language === 'ru';

    const styleDesc = {
        simple: 'Simple and clear. Use basic vocabulary, short sentences, minimal jargon. Suitable for undergraduate assignments.',
        medium: 'Standard academic style. Well-structured arguments, proper terminology, balanced depth. Suitable for coursework and reports.',
        phd: 'Advanced research-grade writing. Dense academic prose, sophisticated analysis, extensive literature engagement, nuanced arguments. PhD/journal-quality.',
    }[s.style];

    const langPackages = isRussian
        ? `\\usepackage[T2A]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[russian]{babel}`
        : `\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}`;

    const columnClass = s.columns === 2 ? 'twocolumn' : '';
    const docClass = columnClass ? `\\documentclass[${columnClass}]{article}` : `\\documentclass{article}`;

    // Build author/course/date block
    let metaBlock = '';
    const authorLine = s.authorName || 'Student';
    const dateLine = s.dateStr || '\\today';
    if (s.courseName || s.groupName || s.supervisorName) {
        const parts: string[] = [];
        if (s.courseName) parts.push(`\\textbf{${isRussian ? 'Курс' : 'Course'}:} ${s.courseName}`);
        if (s.groupName) parts.push(`\\textbf{${isRussian ? 'Группа' : 'Group'}:} ${s.groupName}`);
        if (s.supervisorName) parts.push(`\\textbf{${isRussian ? 'Преподаватель' : 'Supervisor'}:} ${s.supervisorName}`);
        metaBlock = parts.join(' \\qquad ');
    }

    const refInstructions = s.useReferences
        ? `REFERENCES: Include \\usepackage[style=apa, backend=biber]{biblatex} and \\addbibresource{references.bib}.
Use \\textcite{key} and \\parencite{key}. Every citation key MUST match an entry in references_bib.
If user provided reference data (links/files), use them to generate REAL entries in references_bib.
Otherwise, generate 10-20 plausible academic references in references_bib field.`
        : `REFERENCES: Do NOT include biblatex. Set references_bib to null.`;

    const templateSection = s.useTemplate
        ? `
\\geometry{lmargin=0.6in,rmargin=0.6in,tmargin=0.75in,bmargin=0.75in,footskip=20pt${s.columns === 2 ? ',columnsep=0.3in' : ''}}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{${s.courseName || (isRussian ? 'Отчет' : 'Report')}}
\\fancyhead[R]{${dateLine}}
\\fancyfoot[C]{\\thepage}

\\newcommand{\\styledtitle}[1]{\\noindent\\colorbox{black}{\\parbox{\\dimexpr\\linewidth-2\\fboxsep\\relax}{\\centering\\textcolor{white}{\\sffamily\\bfseries\\MakeUppercase{#1}}}}}
\\titleformat{\\section}{\\normalfont}{}{0em}{\\styledtitle}
\\titleformat{\\subsection}{\\normalfont\\normalsize\\sffamily\\bfseries}{}{0em}{}
\\hypersetup{colorlinks=true,linkcolor=black,filecolor=black,urlcolor=blue,citecolor=black}

TITLE BLOCK (use this exact pattern${s.columns === 2 ? ', wrapped in \\twocolumn[\\begin{@twocolumnfalse}...\\end{@twocolumnfalse}]' : ''}):
Title, author "${authorLine}", affiliation "Astana IT University"${metaBlock ? `, metadata: ${metaBlock}` : ''}, date ${dateLine}.
Then \\noindent\\textbf{${isRussian ? 'Аннотация' : 'Abstract'}} \\\\ followed by italic abstract text.`
        : `CREATE YOUR OWN TEMPLATE: Author: "${authorLine}", Affiliation: "Astana IT University" ${metaBlock ? `, Metadata: ${metaBlock}` : ''}`;

    let modeContext = '';
    if (s.type === 'assignment') {
        modeContext = `MODE: Assignment. Adhere STRICTLY to the provided task requirements. Ensure the tone is appropriate for student work but maintains academic rigor.`;
    } else if (s.type === 'diploma') {
        modeContext = `MODE: Thesis / Diploma. Create a highly structured, deep academic document. Use sophisticated vocabulary and extensive sections. Focus on the depth of the topic.`;
    }

    return `You are "Perricheno LaTeX Agent" — an expert academic LaTeX document generator.

══════════════════════════
OUTPUT FORMAT
══════════════════════════

Output ONLY valid JSON. No markdown fences, no commentary:
{"main_tex": "...", "references_bib": "..." }

Escape backslashes properly in JSON (e.g., "\\\\documentclass{article}"). Use \\n for newlines.

══════════════════════════
WRITING STYLE
══════════════════════════

${styleDesc}
Target word count: approximately ${s.wordCount} words of body text.
Language: ${isRussian ? 'Russian (write everything in Russian)' : 'English'}

══════════════════════════
${refInstructions}

══════════════════════════
CRITICAL LATEX RULES
══════════════════════════

1. ${s.columns === 2 ? 'TITLE BLOCK must be wrapped: \\twocolumn[\\begin{@twocolumnfalse}...\\end{@twocolumnfalse}]. NEVER nest other environments incorrectly inside it.' : 'Standard single-column document layout.'}
2. BRACE MATCHING: Every { must have matching }. Count carefully.
3. SECTIONS: Use \\& not & in section names.
4. ${s.useReferences ? 'Every \\textcite{key} must match entries in references_bib.' : 'No citations needed.'}
5. No \\lipsum. Write REAL content.
6. Tables/code/formulas OPTIONAL — only if relevant.
7. Properly escape: & → \\& , % → \\% , # → \\# , _ → \\_
${templateSection}

══════════════════════════
VISUALS / IMAGES
══════════════════════════

When integrating figures:
1. Use the [images/] directory: \\includegraphics[width=0.9\\linewidth]{images/filename.png}.
2. Always use the provided filenames from the message context (e.g., images/fig_1_bar.png).
3. Place figures inside a [figure] environment with [H] or [ht] placement.
4. Provide a descriptive \\caption and a unique \\label.
5. Ensure the preamble contains \\usepackage{graphicx} and optionally \\graphicspath{{images/}}.

══════════════════════════
EDITING & ERROR FIXING
══════════════════════════

When editing: apply changes, return FULL updated files.
When fixing errors: analyze each error, fix code, return FULL corrected files.`;
}

function buildMessages(s: GenerateSettings) {
    const systemPrompt = buildSystemPrompt(s);
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    let contextData = '';
    if (s.taskDescription) contextData += `\nASSIGNMENT TASK DESCRIPTION:\n${s.taskDescription}`;
    if (s.taskFileText) contextData += `\nATTACHED TASK FILE CONTEXT:\n${s.taskFileText}`;
    if (s.referenceLinks && s.referenceLinks.length > 0) contextData += `\nREFERENCE LINKS:\n${s.referenceLinks.join('\n')}`;
    if (s.referenceFilesText && s.referenceFilesText.length > 0) {
        contextData += `\nREFERENCE ARTICLES DATA:\n${s.referenceFilesText.join('\n---\n')}`;
    }

    if (s.errorLog && s.currentTex) {
        messages.push({ role: "assistant", content: JSON.stringify({ main_tex: s.currentTex, references_bib: s.currentBib || null }) });
        messages.push({ role: "user", content: `Fix ALL compilation errors:\n\n${s.errorLog}\n\nReturn FULL corrected JSON.` });
    } else if (s.visuals && s.visuals.length > 0 && s.currentTex) {
        const figureList = s.visuals.map((v, i) => `- images/fig_${i + 1}_${v.chart_type}.png (${v.chart_type} chart)`).join('\n');
        messages.push({ role: "assistant", content: JSON.stringify({ main_tex: s.currentTex, references_bib: s.currentBib || null }) });
        messages.push({ role: "user", content: `Integrate the following figures into the report:\n${figureList}\n\nUser instructions: ${s.prompt}\n\nReturn FULL updated JSON with correct \\includegraphics paths.` });
    } else if (s.currentTex) {
        messages.push({ role: "assistant", content: JSON.stringify({ main_tex: s.currentTex, references_bib: s.currentBib || null }) });
        messages.push({ role: "user", content: `Edit the document. Changes: ${s.prompt}\n\nReturn FULL updated JSON.` });
    } else {
        messages.push({
            role: "user",
            content: `Generate a complete LaTeX document.${contextData ? `\n\nCONTEXT DATA:\n${contextData}` : ''}\n\nType: ${s.type}\nTopic: ${s.prompt}\n\nOutput ONLY raw JSON.`
        });
    }

    return messages;
}

async function runAgentTaskBackground(sessionId: string, messages: any[], userId: number) {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages,
                stream: true,
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error("OpenAI API Error:", errBody);
            await updateAgentSession(sessionId, { status: "error", error_msg: `API error: ${errBody.slice(0, 200)}` });
            
            const session = await getAgentSession(sessionId);
            if (session && session.tg_message_id) {
                await updateTelegramNotification(userId, session.tg_message_id, `❌ *Ошибка генерации*: ${session.title}\n\nПроизошла ошибка API (${errBody.slice(0, 50)}...). Попробуйте еще раз.`);
            }
            return;
        }

        const decoder = new TextDecoder();
        const reader = response.body!.getReader();
        let buffer = "";
        let accumulated = "";
        let lastDbUpdate = Date.now();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                        accumulated += content;
                    }
                } catch {}
            }

            // Sync stream progress to db every 150ms max for a smoother UI experience
            if (Date.now() - lastDbUpdate > 150) {
                await updateAgentSession(sessionId, { stream_text: accumulated });
                
                // Also update Telegram every 2.5 seconds (to avoid rate limits)
                if (Date.now() - lastDbUpdate > 2500) {
                    const session = await getAgentSession(sessionId);
                    if (session && session.tg_message_id) {
                        await updateTelegramNotification(userId, session.tg_message_id, 
                            `⚡ *Процесс генерации*: ${session.title}\n\n` +
                            `✍️ Обработано: ~${accumulated.length} символов\n` +
                            `⏳ Пожалуйста, подождите...`
                        );
                    }
                }
                lastDbUpdate = Date.now();
            }
        }

        // Final db sync
        await updateAgentSession(sessionId, { stream_text: accumulated });

        let clean = accumulated.trim();
        if (clean.startsWith("```json")) clean = clean.substring(7);
        if (clean.startsWith("```")) clean = clean.substring(3);
        if (clean.endsWith("```")) clean = clean.replace(/```\s*$/, "");
        
        let finalData: { main_tex?: string, references_bib?: string } = {};
        try {
            finalData = JSON.parse(clean);
            if (!finalData.main_tex) throw new Error("Invalid output — missing main_tex");
        } catch (e: any) {
            await updateAgentSession(sessionId, { status: "error", error_msg: "AI generated invalid JSON: " + e.message });
            
            const session = await getAgentSession(sessionId);
            if (session) {
                await sendTelegramNotification(userId, `❌ *Ошибка генерации*: ${session.title}\n\nНейросеть вернула некорректный формат данных. Пожалуйста, попробуйте изменить запрос.`);
            }
            return;
        }

        // Success Update
        await updateAgentSession(sessionId, {
            status: "done",
            main_tex: finalData.main_tex,
            references_bib: finalData.references_bib || null,
            stream_text: null,
            error_msg: null
        });

        // Notify telegram with final stats and links
        const session = await getAgentSession(sessionId);
        if (session && session.tg_message_id) {
            const user = await getUserById(userId);
            const remaining = user ? (user.purchased_chars + 15000 - user.daily_chars_used) : 0;
            const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://perricheno.ru'}/agent/shared/${session.share_id}`;
            
            await updateTelegramNotification(userId, session.tg_message_id, 
                `✅ *Генерация завершена*: ${session.title}\n\n` +
                `📊 *Статистика*:\n` +
                `• Использовано: ~${clean.length} символов\n` +
                `• Остаток на балансе: ${remaining} символов\n\n` +
                `🔗 *Ссылки для скачивания*:\n` +
                `• [Посмотреть PDF и ZIP](${pdfUrl})\n\n` +
                `Ваш отчет доступен в истории сессий.`
            );
        }

        // Exact Character Billing Mapping (Prompt + Completion)
        const promptChars = JSON.stringify(messages).length;
        const completionChars = clean.length;
        await checkAndDeductUsage(userId, 'chars', promptChars + completionChars);

    } catch (err: any) {
        console.error("Background Agent Error:", err);
        await updateAgentSession(sessionId, { status: "error", error_msg: err.message || "Unexpected background error." });
    }
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const precheck = await checkAndDeductUsage(userId, 'chars', 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED", details: "Characters limit reached." }, { status: 402 });
    }

    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key is not configured." }, { status: 500 });
    }

    try {
        const body = await req.json();

        const settings: GenerateSettings = {
            prompt: body.prompt || '',
            type: body.type || 'research',
            useTemplate: body.useTemplate ?? true,
            style: body.style || 'medium',
            wordCount: body.wordCount || 2000,
            columns: body.columns || 2,
            useReferences: body.useReferences ?? true,
            language: body.language || 'en',
            authorName: body.authorName,
            courseName: body.courseName,
            dateStr: body.dateStr,
            groupName: body.groupName,
            supervisorName: body.supervisorName,
            taskDescription: body.taskDescription,
            taskFileText: body.taskFileText,
            referenceLinks: body.referenceLinks,
            referenceFilesText: body.referenceFilesText,
            currentTex: body.currentTex,
            currentBib: body.currentBib,
            errorLog: body.errorLog,
            visuals: body.visuals,
            useDbImages: body.useDbImages,
        };

        if (!settings.prompt && !settings.errorLog) {
            return NextResponse.json({ error: "Prompt or error log is required." }, { status: 400 });
        }

        // --- CONCURRENCY LIMIT ---
        const activeCount = await getActiveAgentSessionsCount(userId);
        if (activeCount >= 3) {
            return NextResponse.json({ 
                error: `Достигнут лимит одновременных генераций (макс. 3). Дождитесь завершения текущих задач.` 
            }, { status: 429 });
        }
        // -------------------------

        let sessionId = body.sessionId;

        // If useDbImages, load visuals from the database instead of from the request body
        if (settings.useDbImages && sessionId) {
            const existingSession = await getAgentSession(sessionId);
            if (existingSession?.visuals_json) {
                try {
                    settings.visuals = JSON.parse(existingSession.visuals_json);
                } catch (e) {
                    console.error("Failed to parse visuals_json from DB:", e);
                }
            }
        }

        const messages = buildMessages(settings);

        const shortTitle = settings.prompt.slice(0, 50).trim() || "Generated Document";

        if (!sessionId) {
            sessionId = uuidv4();
            // Automatically generate a share_id for links
            const tempShareId = uuidv4().split('-')[0];

            // Notify Telegram Start
            const msgId = await sendTelegramNotification(userId, `🚀 *Начало генерации*: ${shortTitle}\n\nВаш документ обрабатывается. Это может занять до 2 минут.`);

            await createAgentSession({
                id: sessionId,
                user_id: userId,
                title: shortTitle + (settings.prompt.length > 50 ? '...' : ''),
                doc_type: settings.type,
                status: 'generating',
                stream_text: '',
                share_id: tempShareId,
                tg_message_id: msgId || undefined,
                settings_json: JSON.stringify(settings),
            });
        } else {
            const existing = await getAgentSession(sessionId);
            const shareId = existing?.share_id || uuidv4().split('-')[0];

            // Notify Telegram Re-Start
            const msgId = await sendTelegramNotification(userId, `🔄 *Перегенерация документа*: ${shortTitle}\n\nПрименяем ваши изменения...`);

            await updateAgentSession(sessionId, { 
                status: 'generating', 
                stream_text: '', 
                error_msg: null,
                share_id: shareId,
                tg_message_id: msgId || undefined,
                settings_json: JSON.stringify(settings) 
            });
        }

        // Fire and forget
        runAgentTaskBackground(sessionId, messages, userId);

        return NextResponse.json({ sessionId });

    } catch (err: any) {
        console.error("Agent Error:", err);
        return NextResponse.json({ error: err.message || "Unexpected error." }, { status: 500 });
    }
}
