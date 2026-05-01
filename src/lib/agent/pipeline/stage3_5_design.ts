// Stage 3.5 - Design.
// LLM call to generate a custom LaTeX preamble and title block based on the
// document topic and plan. Focuses on fonts, geometry, and clean formatting.

import { chatCompletion, parseJsonLoose } from "./llm";
import type { Plan, PipelineSettings, DocumentDesign } from "./types";

function buildSystemPrompt(s: PipelineSettings): string {
    return `You are a LaTeX design expert. Your task is to generate a clean, professional visual design for a ${s.docType} about "${s.prompt}".

Output ONLY valid JSON:
{
  "preamble": "string - LaTeX packages and style definitions ONLY. NO documentclass, NO begin{document}. Focus on FONTS and GEOMETRY only.",
  "titleBlock": "string - LaTeX code for the title area. NO begin{document}. Use variables like \\\\thetitle, \\\\theauthor where appropriate, or hardcode them based on the plan."
}

Design Guidelines:
1. Focus ONLY on: font selection, margins/geometry, line spacing, paragraph indentation, header/footer style.
2. Do NOT use custom colors (no xcolor, no \\definecolor, no \\color commands). Keep the document black-and-white.
3. Choose fonts that match the topic (e.g., serif like libertine/charter for classic academic, sans-serif like roboto/inter for modern).
4. For ${s.language === "kk" ? "Kazakh" : "Cyrillic"} languages: 
   - ALWAYS include fontenc T2A (except for fontspec/XeLaTeX).
   - Do NOT include inputenc/babel - the orchestrator handles those.
5. Keep it compilable. Use standard packages: geometry, fancyhdr, setspace, parskip, titlesec.
6. Ensure margins are reasonable (geometry).
7. Title block should be clean and professional.

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
        { jsonMode: true, timeoutMs: 90_000 },
    );

    const parsed = parseJsonLoose(r.text);
    
    return {
        preamble: (parsed.preamble || "").trim(),
        titleBlock: (parsed.titleBlock || "").trim(),
        tokensUsed: r.totalTokens,
    };
}
