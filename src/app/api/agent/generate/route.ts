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

RULE 1 — TITLE BLOCK SYNTAX (this exact pattern, no variations):
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

NEVER put \\begin{abstract} inside @twocolumnfalse. Use \\noindent\\textbf{Abstract} \\\\ instead.
NEVER nest any other environments incorrectly. The ONLY contents between @twocolumnfalse are: center block + abstract text.

RULE 2 — BRACE MATCHING:
Every { must have a matching }. Count your braces carefully. This is the #1 source of errors.
\\textsuperscript{1} — correct
\\textbf{Bold text} — correct

RULE 3 — SECTION COMMANDS (use \\& not &):
\\section{RESULTS \\& DISCUSSION} — correct
\\section{RESULTS & DISCUSSION} — WRONG, will crash

RULE 4 — CITATION KEYS:
If you write \\textcite{smith2023ai} in main_tex, then references_bib MUST contain @article{smith2023ai, ...}
Use simple lowercase keys like: author2024topic, jones2022ml

RULE 5 — NO \\lipsum. Write real content (1500+ words).

RULE 6 — Tables/code/formulas are OPTIONAL. Only include if relevant.

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
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
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

% Only for research/report/diploma types:
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

When editing: receive current files, apply changes, return FULL updated files.
When fixing errors: receive LaTeX compilation errors + current files. Analyze each error, fix the LaTeX code, return corrected FULL files.
Common fixes: brace matching, \\& instead of &, matching citation keys, correct @twocolumnfalse nesting.`;

export async function POST(req: Request) {
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key is not configured." }, { status: 500 });
    }

    try {
        const { prompt, type = "research", currentTex, currentBib, errorLog } = await req.json();

        if (!prompt && !errorLog) {
            return NextResponse.json({ error: "Prompt or error log is required." }, { status: 400 });
        }

        const messages: { role: string; content: string }[] = [
            { role: "system", content: SYSTEM_PROMPT },
        ];

        if (errorLog && currentTex) {
            // Error fix mode
            messages.push({
                role: "assistant",
                content: JSON.stringify({ main_tex: currentTex, references_bib: currentBib || null })
            });
            messages.push({
                role: "user",
                content: `The LaTeX document above has compilation errors. Fix ALL of them.

COMPILATION ERRORS:
${errorLog}

INSTRUCTIONS:
1. Analyze each error carefully
2. Fix brace mismatches, environment nesting, citation keys, special character escaping
3. Make sure \\begin{@twocolumnfalse} and \\end{@twocolumnfalse} are correctly nested
4. Make sure every \\textcite{key} and \\parencite{key} has a matching entry in references.bib
5. Return the FULL corrected JSON with "main_tex" and "references_bib". No markdown fences.`
            });
        } else if (currentTex) {
            // Edit mode
            messages.push({
                role: "assistant",
                content: JSON.stringify({ main_tex: currentTex, references_bib: currentBib || null })
            });
            messages.push({
                role: "user",
                content: `Edit the document above. Changes: ${prompt}\n\nReturn FULL updated JSON. No markdown fences.`
            });
        } else {
            // New generation
            messages.push({
                role: "user",
                content: `Generate a complete LaTeX document.\nType: ${type}\nTopic: ${prompt}\n\nOutput ONLY raw JSON.`
            });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages,
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error("OpenAI API Error:", errBody);
            return NextResponse.json({ error: `API error: ${errBody.slice(0, 200)}` }, { status: 500 });
        }

        const data = await response.json();
        const output = data.choices[0].message.content.trim();

        let cleanJson = output;
        if (cleanJson.startsWith("```")) cleanJson = cleanJson.replace(/^```(?:json)?\s*/, "");
        if (cleanJson.endsWith("```")) cleanJson = cleanJson.replace(/```\s*$/, "");

        const parsed = JSON.parse(cleanJson);

        if (!parsed.main_tex || typeof parsed.main_tex !== "string") {
            return NextResponse.json({ error: "AI generated invalid output." }, { status: 500 });
        }

        return NextResponse.json({
            main_tex: parsed.main_tex,
            references_bib: parsed.references_bib || null,
        });

    } catch (err: any) {
        console.error("Agent Error:", err);
        return NextResponse.json({ error: err.message || "Unexpected error." }, { status: 500 });
    }
}
