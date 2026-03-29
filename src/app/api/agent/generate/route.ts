import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

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
    // For edits/fixes/visuals
    currentTex?: string;
    currentBib?: string;
    errorLog?: string;
    rImages?: { image: string, chart_type: string, r_code: string }[];
}

function buildSystemPrompt(s: GenerateSettings): string {
    const isRussian = s.language === 'ru';

    const styleDesc = {
        simple: 'Simple and clear. Use basic vocabulary, short sentences, minimal jargon. Suitable for undergraduate assignments.',
        medium: 'Standard academic style. Well-structured arguments, proper terminology, balanced depth. Suitable for coursework and reports.',
        phd: 'Advanced research-grade writing. Dense academic prose, sophisticated analysis, extensive literature engagement, nuanced arguments. PhD/journal-quality.',
    }[s.style];

    const langPackages = isRussian
        ? `\\\\usepackage[T2A]{fontenc}\n\\\\usepackage[utf8]{inputenc}\n\\\\usepackage[russian]{babel}`
        : `\\\\usepackage[T1]{fontenc}\n\\\\usepackage[utf8]{inputenc}`;

    const columnClass = s.columns === 2 ? 'twocolumn' : '';
    const docClass = columnClass ? `\\\\documentclass[${columnClass}]{article}` : `\\\\documentclass{article}`;

    // Build author/course/date block
    let metaBlock = '';
    const authorLine = s.authorName || 'Amangeldy Shyngyskhan';
    const dateLine = s.dateStr || '\\\\today';
    if (s.courseName || s.groupName || s.supervisorName) {
        const parts: string[] = [];
        if (s.courseName) parts.push(`\\\\textbf{${isRussian ? 'Курс' : 'Course'}:} ${s.courseName}`);
        if (s.groupName) parts.push(`\\\\textbf{${isRussian ? 'Группа' : 'Group'}:} ${s.groupName}`);
        if (s.supervisorName) parts.push(`\\\\textbf{${isRussian ? 'Преподаватель' : 'Supervisor'}:} ${s.supervisorName}`);
        metaBlock = parts.join(' \\\\qquad ');
    }

    const refInstructions = s.useReferences
        ? `REFERENCES: Include \\\\usepackage[style=apa, backend=biber]{biblatex} and \\\\addbibresource{references.bib}.
Use \\\\textcite{key} and \\\\parencite{key}. Every citation key MUST match an entry in references_bib.
Generate 10-20 plausible academic references in references_bib field.
End document with \\\\printbibliography.`
        : `REFERENCES: Do NOT include biblatex. Set references_bib to null.`;

    const templateSection = s.useTemplate
        ? `
══════════════════════════
USE PERRICHENO TEMPLATE
══════════════════════════

Use this EXACT preamble structure:

${docClass}
${langPackages}
\\\\usepackage{tgtermes}
\\\\usepackage{tgheros}
\\\\usepackage{microtype}
\\\\usepackage{graphicx}
\\\\usepackage{tabularx}
\\\\usepackage{ragged2e}
\\\\usepackage{booktabs}
\\\\usepackage{amsmath,amsfonts,amssymb}
\\\\usepackage{longtable}
\\\\usepackage[table]{xcolor}
\\\\usepackage{caption}
\\\\usepackage{hyperref}
\\\\usepackage{csquotes}
\\\\usepackage{geometry}
\\\\usepackage{fancyhdr}
\\\\usepackage{titlesec}
\\\\usepackage{float}
\\\\usepackage{listings}

\\\\geometry{lmargin=0.6in,rmargin=0.6in,tmargin=0.75in,bmargin=0.75in,footskip=20pt${s.columns === 2 ? ',columnsep=0.3in' : ''}}
\\\\pagestyle{fancy}
\\\\fancyhf{}
\\\\fancyhead[L]{${s.courseName || (isRussian ? 'Отчет' : 'Report')}}
\\\\fancyhead[R]{${dateLine}}
\\\\fancyfoot[C]{\\\\thepage}

\\\\newcommand{\\\\styledtitle}[1]{\\\\noindent\\\\colorbox{black}{\\\\parbox{\\\\dimexpr\\\\linewidth-2\\\\fboxsep\\\\relax}{\\\\centering\\\\textcolor{white}{\\\\sffamily\\\\bfseries\\\\MakeUppercase{#1}}}}}
\\\\titleformat{\\\\section}{\\\\normalfont}{}{0em}{\\\\styledtitle}
\\\\titleformat{\\\\subsection}{\\\\normalfont\\\\normalsize\\\\sffamily\\\\bfseries}{}{0em}{}
\\\\titleformat{\\\\subsubsection}{\\\\normalfont\\\\normalsize\\\\sffamily\\\\itshape}{}{0em}{}
\\\\hypersetup{colorlinks=true,linkcolor=black,filecolor=black,urlcolor=blue,citecolor=black}

TITLE BLOCK (use this exact pattern${s.columns === 2 ? ', wrapped in \\\\twocolumn[\\\\begin{@twocolumnfalse}...\\\\end{@twocolumnfalse}]' : ''}):
Title, author "${authorLine}", affiliation "Astana IT University"${metaBlock ? `, metadata: ${metaBlock}` : ''}, date ${dateLine}.
Then \\\\noindent\\\\textbf{${isRussian ? 'Аннотация' : 'Abstract'}} \\\\\\\\ followed by italic abstract text.`
        : `
══════════════════════════
CREATE YOUR OWN TEMPLATE
══════════════════════════

Design a professional, beautiful LaTeX document template from scratch.
Requirements:
- ${docClass}
- ${langPackages}
- Use professional fonts and clean layout
- Include proper geometry, headers/footers
- Make it visually appealing — use colors, custom section styles, clean typography
- Author: "${authorLine}", Affiliation: "Astana IT University"
${metaBlock ? `- Metadata: ${metaBlock}` : ''}
- Date: ${dateLine}
- Include an abstract section
- Be creative with the design — don't just copy a generic template`;

    return `You are "Perricheno LaTeX Agent" — an expert academic LaTeX document generator.

══════════════════════════
OUTPUT FORMAT
══════════════════════════

Output ONLY valid JSON. No markdown fences, no commentary:
{"main_tex": "...", "references_bib": "..." }

Backslashes = \\\\\\\\ in JSON. Newlines = \\n. Quotes = \\".

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

1. ${s.columns === 2 ? 'TITLE BLOCK must be wrapped: \\\\twocolumn[\\\\begin{@twocolumnfalse}...\\\\end{@twocolumnfalse}]. NEVER nest other environments incorrectly inside it.' : 'Standard single-column document layout.'}
2. BRACE MATCHING: Every { must have matching }. Count carefully.
3. SECTIONS: Use \\\\& not & in section names.
4. ${s.useReferences ? 'Every \\\\textcite{key} must match entries in references_bib.' : 'No citations needed.'}
5. No \\\\lipsum. Write REAL content.
6. Tables/code/formulas OPTIONAL — only if relevant.
7. Properly escape: & → \\\\& , % → \\\\% , # → \\\\# , _ → \\\\_
${templateSection}

══════════════════════════
EDITING & ERROR FIXING
══════════════════════════

When editing: apply changes, return FULL updated files.
When fixing errors: analyze each error, fix code, return FULL corrected files.`;
}

function buildMessages(s: GenerateSettings) {
    const systemPrompt = buildSystemPrompt(s);
    const messages: any[] = [
        { role: "system", content: systemPrompt },
    ];

    if (s.errorLog && s.currentTex) {
        messages.push({
            role: "assistant",
            content: JSON.stringify({ main_tex: s.currentTex, references_bib: s.currentBib || null })
        });
        messages.push({
            role: "user",
            content: `Fix ALL compilation errors:\n\n${s.errorLog}\n\nReturn FULL corrected JSON.`
        });
    } else if (s.rImages && s.rImages.length > 0 && s.currentTex) {
        messages.push({
            role: "assistant",
            content: JSON.stringify({ main_tex: s.currentTex, references_bib: s.currentBib || null })
        });
        
        const contentArr: any[] = [
            { type: "text", text: `The following ${s.rImages.length} figures have been generated using R. Please edit the document to include them using \\begin{figure} and \\includegraphics{figures/fig_...png}. You MUST also write an analytical description of what these plots are showing within the text.\n\nThe user's extra instructions: ${s.prompt}\n\nReturn FULL updated JSON. Here are the images and their filenames rules:\n` }
        ];

        s.rImages.forEach((img, i) => {
            const filename = `figures/fig_${i + 1}_${img.chart_type}.png`;
            contentArr.push({ type: "text", text: `Filename: ${filename}\nR Source that generated this:\n\`\`\`R\n${img.r_code}\n\`\`\`\n` });
            contentArr.push({ type: "image_url", image_url: { url: `data:image/png;base64,${img.image}` } });
        });

        messages.push({ role: "user", content: contentArr });
    } else if (s.currentTex) {
        messages.push({
            role: "assistant",
            content: JSON.stringify({ main_tex: s.currentTex, references_bib: s.currentBib || null })
        });
        messages.push({
            role: "user",
            content: `Edit the document. Changes: ${s.prompt}\n\nReturn FULL updated JSON.`
        });
    } else {
        messages.push({
            role: "user",
            content: `Generate a complete LaTeX document.\nType: ${s.type}\nTopic: ${s.prompt}\n\nOutput ONLY raw JSON.`
        });
    }

    return messages;
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
            currentTex: body.currentTex,
            currentBib: body.currentBib,
            errorLog: body.errorLog,
            rImages: body.rImages,
        };

        if (!settings.prompt && !settings.errorLog) {
            return NextResponse.json({ error: "Prompt or error log is required." }, { status: 400 });
        }

        const messages = buildMessages(settings);

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
            return NextResponse.json({ error: `API error: ${errBody.slice(0, 200)}` }, { status: 500 });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body!.getReader();
                let buffer = "";

                try {
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
                                    controller.enqueue(encoder.encode(content));
                                }
                            } catch {}
                        }
                    }
                } catch (err) {
                    console.error("Stream error:", err);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    } catch (err: any) {
        console.error("Agent Error:", err);
        return NextResponse.json({ error: err.message || "Unexpected error." }, { status: 500 });
    }
}
