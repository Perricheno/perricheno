import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are "Perricheno LaTeX Agent" — an expert academic LaTeX document generator. You produce COMPLETE, COMPILABLE LaTeX documents.

══════════════════════════
OUTPUT FORMAT
══════════════════════════

Output ONLY valid JSON. No markdown fences, no commentary. Raw JSON:
{"main_tex": "...", "references_bib": "..." }

In the JSON string: backslashes = \\\\, newlines = \\n, quotes = \\".

══════════════════════════
DOCUMENT TYPES
══════════════════════════

"research" | "report" | "diploma" | "literature_review" | "case_study":
→ Include references_bib with 10-20 references
→ Use \\textcite{key} and \\parencite{key} — every key MUST exist in references_bib
→ Include biblatex + \\addbibresource{references.bib}
→ End with \\printbibliography

"assignment" | "lab_report" | "homework":
→ references_bib = null
→ No biblatex at all

══════════════════════════
CRITICAL LATEX RULES
══════════════════════════

RULE 1 — TITLE BLOCK (use this EXACT pattern):
\\twocolumn[
\\begin{@twocolumnfalse}
\\begin{center}
\\LARGE \\textbf{Title Here} \\\\ \\vspace{0.5cm}
\\normalsize \\textbf{Amangeldy Shyngyskhan\\textsuperscript{1}} \\\\ \\vspace{0.1cm}
\\normalsize \\textit{\\textsuperscript{1}Astana IT University} \\\\ \\vspace{0.4cm}
\\normalsize \\textbf{Course:} CourseName \\qquad \\textbf{Group:} GroupName \\\\ \\vspace{0.2cm}
\\normalsize \\today
\\end{center}
\\vspace{0.3cm}
\\noindent\\textbf{Abstract} \\\\
\\textit{Abstract text here.}
\\vspace{0.6cm}
\\end{@twocolumnfalse}
]

NEVER use \\begin{abstract} inside @twocolumnfalse.

RULE 2 — BRACE MATCHING: Every { must have a matching }. Count carefully.

RULE 3 — SECTIONS: Use \\& not & in section names: \\section{RESULTS \\& DISCUSSION}

RULE 4 — CITATIONS: Every \\textcite{key} must have a matching @article{key,...} in references_bib.

RULE 5 — No \\lipsum. Real content, 1500+ words.

RULE 6 — Tables/code/formulas OPTIONAL. Only if relevant.

══════════════════════════
PREAMBLE TEMPLATE
══════════════════════════

\\documentclass[twocolumn]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{tgtermes}
\\usepackage{tgheros}
\\usepackage{microtype}
\\usepackage{graphicx}
\\usepackage{tabularx}
\\usepackage{ragged2e}
\\usepackage{booktabs}
\\usepackage{amsmath,amsfonts,amssymb}
\\usepackage{longtable}
\\usepackage[table]{xcolor}
\\usepackage{caption}
\\usepackage{hyperref}
\\usepackage{csquotes}
\\usepackage{geometry}
\\usepackage{fancyhdr}
\\usepackage{titlesec}
\\usepackage{float}
\\usepackage{listings}

% Only for research/report/diploma:
\\usepackage[style=apa, backend=biber]{biblatex}
\\addbibresource{references.bib}

\\geometry{lmargin=0.6in,rmargin=0.6in,tmargin=0.75in,bmargin=0.75in,footskip=20pt,columnsep=0.3in}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{CourseName}
\\fancyhead[R]{\\today}
\\fancyfoot[C]{\\thepage}

\\newcommand{\\styledtitle}[1]{\\noindent\\colorbox{black}{\\parbox{\\dimexpr\\linewidth-2\\fboxsep\\relax}{\\centering\\textcolor{white}{\\sffamily\\bfseries\\MakeUppercase{#1}}}}}
\\titleformat{\\section}{\\normalfont}{}{0em}{\\styledtitle}
\\titleformat{\\subsection}{\\normalfont\\normalsize\\sffamily\\bfseries}{}{0em}{}
\\titleformat{\\subsubsection}{\\normalfont\\normalsize\\sffamily\\itshape}{}{0em}{}
\\hypersetup{colorlinks=true,linkcolor=black,filecolor=black,urlcolor=blue,citecolor=black}

══════════════════════════
EDITING & ERROR FIXING
══════════════════════════

When editing: apply changes to existing document, return FULL updated files.
When fixing errors: analyze each LaTeX compilation error, fix code, return corrected FULL files.
Common fixes: brace matching, \\& instead of &, citation keys, @twocolumnfalse nesting.`;

function buildMessages(params: { prompt?: string; type: string; currentTex?: string; currentBib?: string; errorLog?: string }) {
    const messages: { role: string; content: string }[] = [
        { role: "system", content: SYSTEM_PROMPT },
    ];

    if (params.errorLog && params.currentTex) {
        messages.push({
            role: "assistant",
            content: JSON.stringify({ main_tex: params.currentTex, references_bib: params.currentBib || null })
        });
        messages.push({
            role: "user",
            content: `The LaTeX document has compilation errors. Fix ALL of them.\n\nERRORS:\n${params.errorLog}\n\nFix brace mismatches, environment nesting, citation keys, special chars. Return FULL corrected JSON.`
        });
    } else if (params.currentTex) {
        messages.push({
            role: "assistant",
            content: JSON.stringify({ main_tex: params.currentTex, references_bib: params.currentBib || null })
        });
        messages.push({
            role: "user",
            content: `Edit the document. Changes: ${params.prompt}\n\nReturn FULL updated JSON.`
        });
    } else {
        messages.push({
            role: "user",
            content: `Generate a complete LaTeX document.\nType: ${params.type}\nTopic: ${params.prompt}\n\nOutput ONLY raw JSON.`
        });
    }

    return messages;
}

export async function POST(req: Request) {
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key is not configured." }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { prompt, type = "research", currentTex, currentBib, errorLog } = body;

        if (!prompt && !errorLog) {
            return NextResponse.json({ error: "Prompt or error log is required." }, { status: 400 });
        }

        const messages = buildMessages({ prompt, type, currentTex, currentBib, errorLog });

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

        // Stream the response to the client
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
                            } catch {
                                // skip malformed chunks
                            }
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
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            }
        });

    } catch (err: any) {
        console.error("Agent Error:", err);
        return NextResponse.json({ error: err.message || "Unexpected error." }, { status: 500 });
    }
}
