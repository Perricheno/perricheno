// Stage 3.5 - Design.
// LLM call to generate a custom LaTeX preamble and title block based on the
// document topic and plan. This restores visual uniqueness to reports.

import { chatCompletion, parseJsonLoose } from "./llm";
import type { Plan, PipelineSettings, DocumentDesign } from "./types";

const DESIGN_EXAMPLES = `
Example 1: Modern Corporate Report
Preamble: 
\\usepackage[sfdefault]{roboto}
\\usepackage[explicit]{titlesec}
\\definecolor{accent}{HTML}{2E5894}
\\titleformat{\\section}{\\color{accent}\\Large\\bfseries}{\\thesection}{1em}{#1}[\\titlerule]
...
TitleBlock:
\\begin{flushleft}
\\Huge\\bfseries\\color{accent} Title \\\\
\\large\\normalfont Author Name
\\end{flushleft}

Example 2: Classic Scientific Paper
Preamble:
\\usepackage{libertine}
\\usepackage{abstract}
...
TitleBlock:
\\begin{center}
\\LARGE Title \\\\
\\vspace{0.5em}
\\large Author Name \\\\
\\textit{Astana IT University}
\\end{center}
`;

function buildSystemPrompt(s: PipelineSettings): string {
    return `You are a LaTeX design expert. Your task is to generate a CUSTOM visual design for a ${s.docType} about "${s.prompt}".

Output ONLY valid JSON:
{
  "preamble": "string - LaTeX packages and style definitions ONLY. NO documentclass, NO begin{document}. Focus on fonts, colors, section styles, geometry.",
  "titleBlock": "string - LaTeX code for the title area. NO begin{document}. Use variables like \\\\thetitle, \\\\theauthor where appropriate, or hardcode them based on the plan."
}

Design Guidelines:
1. Choose fonts and styles that match the topic. (e.g., serif for classic, sans-serif for modern).
2. For ${s.language === "kk" ? "Kazakh" : "Cyrillic"} languages: 
   - ALWAYS include fontenc T2A (except for fontspec/XeLaTeX).
   - Do NOT include inputenc/babel - the orchestrator handles those.
3. Be creative but keep it compilable. Use standard packages: titlesec, xcolor, geometry, fancyhdr, enumitem, booktabs, etoolbox.
4. Ensure margins are reasonable (geometry).
5. Title block should look premium and unique.

Example Designs for inspiration:
${DESIGN_EXAMPLES}

Do NOT output markdown. JSON only.`;
}

export async function runStage3_5(
    settings: PipelineSettings,
    plan: Plan,
): Promise<DocumentDesign> {
    const systemPrompt = buildSystemPrompt(settings);
    const userPrompt = `Document Topic: ${settings.prompt}\nDocument Title: ${plan.title}\nDocument Type: ${settings.docType}\nAuthor: ${settings.authorName || "Author"}`;

    const r = await chatCompletion(
        [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        { jsonMode: true, timeoutMs: 45_000 },
    );

    const parsed = parseJsonLoose(r.text);
    
    return {
        preamble: (parsed.preamble || "").trim(),
        titleBlock: (parsed.titleBlock || "").trim(),
        tokensUsed: r.totalTokens,
    };
}
