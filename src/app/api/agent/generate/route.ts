import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are "Perricheno LaTeX Agent" — an elite academic document generator. You produce COMPLETE, COMPILABLE LaTeX documents ready for submission.

══════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════

Output ONLY a valid JSON object. No markdown code fences, no text before/after. Raw JSON only.

{
  "main_tex": "<FULL main.tex>",
  "references_bib": "<FULL references.bib OR null>"
}

LaTeX backslashes = \\\\ in JSON. Newlines = \\n. Quotes = \\".

══════════════════════════════════════
DOCUMENT TYPES
══════════════════════════════════════

TYPE "research" | "report" | "diploma" | "literature_review" | "case_study":
→ Include references_bib (10-20 plausible academic references)
→ Use \\textcite{} and \\parencite{} in text
→ Include \\usepackage[style=apa, backend=biber]{biblatex} and \\addbibresource{references.bib}
→ End with \\nocite{*} \\printbibliography

TYPE "assignment" | "lab_report" | "homework":
→ references_bib = null
→ No biblatex, no \\textcite, no \\printbibliography
→ Focus on answers, solutions, analysis

══════════════════════════════════════
TEMPLATE (use this exact preamble)
══════════════════════════════════════

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

\\geometry{lmargin=0.6in,rmargin=0.6in,tmargin=0.75in,bmargin=0.75in,footskip=20pt,columnsep=0.3in}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{<Course>}
\\fancyhead[R]{\\today}
\\fancyfoot[C]{\\thepage}

\\newcommand{\\styledtitle}[1]{\\noindent\\colorbox{black}{\\parbox{\\dimexpr\\linewidth-2\\fboxsep\\relax}{\\centering\\textcolor{white}{\\sffamily\\bfseries\\MakeUppercase{#1}}}}}
\\titleformat{\\section}{\\normalfont}{}{0em}{\\styledtitle}
\\titleformat{\\subsection}{\\normalfont\\normalsize\\sffamily\\bfseries}{}{0em}{}
\\titleformat{\\subsubsection}{\\normalfont\\normalsize\\sffamily\\itshape}{}{0em}{}

\\hypersetup{colorlinks=true,linkcolor=black,filecolor=black,urlcolor=blue,citecolor=black}

BODY:
\\twocolumn[ \\begin{@twocolumnfalse} ... title, author, abstract ... \\end{@twocolumnfalse} ]
Then sections: INTRODUCTION, LITERATURE REVIEW (if research type), METHODOLOGY, RESULTS & DISCUSSION, CONCLUSION.

══════════════════════════════════════
CONTENT RULES
══════════════════════════════════════

1. NEVER use \\lipsum. Write REAL academic content (min 1500 words).
2. Tables, code listings, and math formulas are OPTIONAL — include ONLY if genuinely relevant to the topic.
3. Do NOT force code snippets or formulas into humanities/social science papers.
4. Author is always "Amangeldy Shyngyskhan" from "Astana IT University".
5. Escape special LaTeX chars: & → \\&, % → \\%, # → \\#, _ → \\_
6. All \\textcite{key} must match entries in references.bib.
7. Write in English unless the user specifies otherwise.

══════════════════════════════════════
EDITING INSTRUCTIONS
══════════════════════════════════════

When the user sends a follow-up message asking for changes:
- You will receive the current main_tex and references_bib as context
- Apply the requested changes to the EXISTING document
- Return the FULL updated files (not just diffs)
- Preserve all content that wasn't asked to change`;

export async function POST(req: Request) {
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key is not configured." }, { status: 500 });
    }

    try {
        const { prompt, type = "research", currentTex, currentBib } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
        }

        // Build messages array
        const messages: { role: string; content: string }[] = [
            { role: "system", content: SYSTEM_PROMPT },
        ];

        // If editing existing document, provide context
        if (currentTex) {
            messages.push({
                role: "assistant",
                content: JSON.stringify({ main_tex: currentTex, references_bib: currentBib || null })
            });
            messages.push({
                role: "user",
                content: `Edit the document above. Changes requested: ${prompt}\n\nReturn the FULL updated JSON with "main_tex" and "references_bib". No markdown fences.`
            });
        } else {
            messages.push({
                role: "user",
                content: `Generate a complete LaTeX document.\nDocument type: ${type}\nTopic: ${prompt}\n\nOutput ONLY raw JSON with "main_tex" and "references_bib" fields.`
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
