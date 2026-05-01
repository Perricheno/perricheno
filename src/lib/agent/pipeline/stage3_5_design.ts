// Stage 3.5 - Design.
// LLM call to generate a custom LaTeX preamble and title block based on the
// document topic and plan. Focuses on fonts, geometry, and clean formatting.
// Now explicitly looks for styling instructions in the user's prompt.

import { chatCompletion, parseJsonLoose } from "./llm";
import type { Plan, PipelineSettings, DocumentDesign } from "./types";

function buildSystemPrompt(s: PipelineSettings): string {
    return `You are a LaTeX design expert. Your task is to generate a clean, professional visual design for a ${s.docType}.
The user's prompt may contain specific design instructions (like "use two columns", "modern font", "minimalist style"). You MUST honor them.

Output ONLY valid JSON:
{
  "preamble": "string - LaTeX packages and style definitions ONLY. NO documentclass, NO begin{document}. Focus on FONTS, GEOMETRY, and spacing.",
  "titleBlock": "string - LaTeX code for the title area. NO begin{document}. You can use \\maketitle or a custom center/flushright environment."
}

Design Guidelines:
1. Focus ONLY on: font selection, margins/geometry, line spacing, paragraph indentation, header/footer style.
2. Honor any specific layout requests from the topic prompt: "${s.prompt}".
3. Do NOT use custom colors (no xcolor, no \\definecolor, no \\color commands). Keep the document black-and-white.
4. For ${s.language === "kk" ? "Kazakh" : "Cyrillic"} languages: 
   - DO NOT include fontenc, inputenc, or babel. The orchestrator handles these. 
   - If generating font settings, assume the orchestrator uses T2A for Cyrillic and fontspec for Kazakh.
5. Keep it compilable. Use standard packages: geometry, fancyhdr, setspace, parskip, titlesec.
6. Ensure margins are reasonable (geometry) unless specific values are requested.
7. Title block should be clean and professional.

Do NOT output markdown. JSON only.`;
}

export async function runStage3_5(
    settings: PipelineSettings,
    plan: Plan,
): Promise<DocumentDesign> {
    const systemPrompt = buildSystemPrompt(settings);
    const userPrompt = `DOCUMENT TOPIC AND INSTRUCTIONS: ${settings.prompt}
DOCUMENT TITLE: ${plan.title}
DOCUMENT TYPE: ${settings.docType}
AUTHOR: ${settings.authorName || "Author"}`;

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
