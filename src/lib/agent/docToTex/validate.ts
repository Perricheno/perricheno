// Doc-to-TeX's own compile-verify-repair loop. Reuses ../pipeline/stage5_validate's
// `compile()` primitive (same latex-compiler service, same zip-building), but
// repairs are *windowed*: instead of resending the full document (pipeline's
// approach, fine for report generation's word-count-bounded output, wrong
// here where documents can run to tens of thousands of words), a failed
// compile's error log is parsed for pdflatex's "l.NNN" line references, and
// only a bounded window of main.tex around those lines is sent back to the
// repair model. This is the same anti-confusion principle as the layer-2b
// chunk split, applied to the fix-up step instead of the writing step - a
// long document's repair pass shouldn't need to re-read the whole thing any
// more than its transcription pass did.
//
// If a log carries no parseable line number (rare - usually a fatal/setup
// error), or the final attempt is still broken, falls back to one
// full-document repair call as a safety net, same shape as pipeline's Stage 5.

import { chatCompletion, parseJsonLoose } from "../pipeline/llm";
import { compile } from "../pipeline/stage5_validate";
import type { GeneratedDataFigure } from "../pipeline/types";

const MAX_REPAIR_ATTEMPTS = 2;
const WINDOW_RADIUS_LINES = 60;

export interface DocToTexValidateResult {
    compiled: boolean;
    repairAttempts: number;
    errorLog?: string;
    finalMainTex: string;
    tokensUsed: number;
    pdfBuffer?: Buffer;
}

function extractErrorLineNumbers(log: string): number[] {
    return [...log.matchAll(/\bl\.(\d+)\b/g)].map(m => Number(m[1]));
}

function windowAround(mainTex: string, lineNumbers: number[]): { excerpt: string; startLine: number; endLine: number } | null {
    if (lineNumbers.length === 0) return null;
    const lines = mainTex.split("\n");
    const startLine = Math.max(1, Math.min(...lineNumbers) - WINDOW_RADIUS_LINES);
    const endLine = Math.min(lines.length, Math.max(...lineNumbers) + WINDOW_RADIUS_LINES);
    return { excerpt: lines.slice(startLine - 1, endLine).join("\n"), startLine, endLine };
}

async function repairWindowed(mainTex: string, errorLog: string): Promise<{ mainTex: string; tokensUsed: number } | null> {
    const win = windowAround(mainTex, extractErrorLineNumbers(errorLog));
    if (!win) return null;

    const system = `You are a LaTeX debugging expert. You will see a compiler error log and an EXCERPT of a larger document (lines ${win.startLine}-${win.endLine} of the full file) around where the error occurred.

Output ONLY valid JSON: {"fixed_excerpt": "…corrected excerpt, same line count as given…"}

Rules:
- Fix only what the error log points to. Preserve all other content verbatim - do not paraphrase prose.
- Return the FULL excerpt back (all ${win.endLine - win.startLine + 1} lines), not a diff.
- The excerpt may open/close braces or environments that continue outside its boundaries - keep it internally consistent with what you can see; do not try to "close" something you can't see opened.
- No markdown fences, no commentary.`;

    const user = `COMPILER ERROR LOG:\n${errorLog}\n\nEXCERPT (lines ${win.startLine}-${win.endLine}):\n${win.excerpt}`;

    const r = await chatCompletion(
        [{ role: "system", content: system }, { role: "user", content: user }],
        { jsonMode: true, timeoutMs: 90_000 },
    );
    const parsed = parseJsonLoose(r.text);
    const fixedExcerpt: string = parsed.fixed_excerpt || win.excerpt;

    const lines = mainTex.split("\n");
    const newLines = [...lines.slice(0, win.startLine - 1), ...fixedExcerpt.split("\n"), ...lines.slice(win.endLine)];
    return { mainTex: newLines.join("\n"), tokensUsed: r.totalTokens };
}

async function repairFull(mainTex: string, errorLog: string): Promise<{ mainTex: string; tokensUsed: number }> {
    const system = `You are a LaTeX debugging expert. Fix ALL errors the compiler log reports. Output ONLY valid JSON: {"main_tex": "…full corrected document…"}. Preserve content - minimal surgical edits only, no paraphrasing. No markdown fences, no commentary.`;
    const user = `COMPILER ERROR LOG:\n${errorLog}\n\nCURRENT main.tex:\n${mainTex}`;
    const r = await chatCompletion(
        [{ role: "system", content: system }, { role: "user", content: user }],
        { jsonMode: true, timeoutMs: 120_000 },
    );
    const parsed = parseJsonLoose(r.text);
    return { mainTex: (parsed.main_tex || mainTex).trim(), tokensUsed: r.totalTokens };
}

export async function validateDocToTex(
    mainTex: string,
    dataFigures: GeneratedDataFigure[],
    onAttempt?: (attempt: number, outcome: "ok" | "failed") => void,
): Promise<DocToTexValidateResult> {
    let tex = mainTex;
    let tokensUsed = 0;
    let lastLog: string | undefined;

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
        try {
            const r = await compile(tex, null, dataFigures);
            if (r.ok) {
                onAttempt?.(attempt, "ok");
                return { compiled: true, repairAttempts: attempt, finalMainTex: tex, tokensUsed, pdfBuffer: r.pdfBuffer };
            }
            lastLog = r.log;
            onAttempt?.(attempt, "failed");
        } catch (e: any) {
            lastLog = String(e?.message || e);
            break; // infra failure - repair won't help
        }

        if (attempt === MAX_REPAIR_ATTEMPTS) break;

        try {
            const isLastChance = attempt === MAX_REPAIR_ATTEMPTS - 1;
            const fixed = isLastChance
                ? await repairFull(tex, lastLog ?? "Unknown error")
                : (await repairWindowed(tex, lastLog ?? "Unknown error")) ?? await repairFull(tex, lastLog ?? "Unknown error");
            tex = fixed.mainTex;
            tokensUsed += fixed.tokensUsed;
        } catch (e: any) {
            console.error("[docToTex/validate] repair failed:", e);
            break;
        }
    }

    return { compiled: false, repairAttempts: MAX_REPAIR_ATTEMPTS, errorLog: lastLog, finalMainTex: tex, tokensUsed };
}
