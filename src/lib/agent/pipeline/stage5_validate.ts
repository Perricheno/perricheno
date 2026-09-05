// Stage 5 - Validate.
// Sends the assembled document to the LaTeX compiler. If compilation fails,
// asks the model to repair only what's broken and retries. Up to 2 repair
// cycles. Final output is whatever compiled last; the orchestrator decides
// whether to surface a "needs_attention" status if the final attempt failed.

import JSZip from "jszip";
import { chatCompletion, parseJsonLoose, type ChatMessage } from "./llm";
import { normalizeLatexText, ensureRussianPreamble, BABEL_LANG_MAP } from "../stages";
import type { AssembledDoc, GeneratedDataFigure, PipelineSettings } from "./types";

const CYRILLIC_LANGS = new Set(["ru", "uk", "kk", "bg", "sr", "mk", "be"]);

const COMPILER_URL = process.env.LATEX_COMPILER_URL;
const COMPILER_KEY = process.env.LATEX_COMPILER_KEY;
const MAX_REPAIR_ATTEMPTS = 2;

export interface Stage5Result {
    compiled: boolean;
    repairAttempts: number;
    errorLog?: string;
    finalMainTex: string;
    finalReferencesBib: string | null;
    tokensUsed: number;
}

// ── Low-level compile ──
// Returns { ok: true } when the compiler returns a PDF, or { ok: false, log }
// when it returns text/json with errors. Network failures throw.

// Strip \begin{figure}...\end{figure} blocks whose image file has no matching PNG in the ZIP.
// This is the last-line-of-defence: regardless of why a PNG didn't make it into the visuals
// array, the LaTeX will never reference a file that isn't actually in the ZIP.
function stripOrphanedFigures(tex: string, availableFiles: Set<string>): string {
    // Match \begin{figure}[...] ... \end{figure} blocks (non-greedy, dotall)
    return tex.replace(
        /\\begin\{figure\}[\s\S]*?\\end\{figure\}/g,
        (block) => {
            const match = block.match(/\\includegraphics(?:\[.*?\])?\{([^}]+)\}/);
            if (!match) return block; // no includegraphics — keep as-is
            // Normalize: strip leading "figures/" so we match just the filename
            const refPath = match[1].replace(/^figures\//, "");
            // Keep block only if the file exists in the ZIP
            return availableFiles.has(refPath) ? block : "";
        },
    );
}

// Exported for reuse by docToTex/validate.ts, which needs the same
// compile-a-zip-and-report-the-log primitive but drives its own repair loop
// (windowed by compiler error line, not full-document) on top of it.
export async function compile(
    mainTex: string,
    referencesBib: string | null,
    dataFigures: GeneratedDataFigure[] = [],
): Promise<{ ok: true; pdfBuffer: Buffer } | { ok: false; log: string }> {
    if (!COMPILER_URL || !COMPILER_KEY) {
        throw new Error("LATEX_COMPILER_URL / LATEX_COMPILER_KEY not configured");
    }

    const zip = new JSZip();

    // TikZ visuals are already inlined in mainTex by stage4 — no PNG files needed for them.
    // Only dataFigures (R/Python charts) still use external PNG files.
    const availableFiles = new Set<string>();
    for (const df of dataFigures) {
        if (df.pngBase64) {
            zip.file(`figures/${df.filename}`, Buffer.from(df.pngBase64, "base64"));
            availableFiles.add(df.filename);
        }
    }

    // Strip any \includegraphics figure blocks whose dataFigure PNG isn't in the ZIP
    const safeTex = stripOrphanedFigures(mainTex, availableFiles);
    if (safeTex !== mainTex) {
        console.log(`[Stage5] Stripped ${(mainTex.match(/\\begin\{figure\}/g)?.length ?? 0) - (safeTex.match(/\\begin\{figure\}/g)?.length ?? 0)} orphaned figure(s) from LaTeX`);
    }

    zip.file("main.tex", safeTex);
    if (referencesBib) zip.file("references.bib", referencesBib);
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const form = new FormData();
    form.append("file", zipBlob, "project.zip");

    const res = await fetch(COMPILER_URL, {
        method: "POST",
        headers: { "x-api-key": COMPILER_KEY },
        body: form,
        signal: AbortSignal.timeout(120_000),
    });

    const ct = res.headers.get("content-type") || "";
    if (res.ok && !ct.includes("json") && !ct.includes("text")) {
        // PDF returned - success.
        const pdfBuffer = Buffer.from(await res.arrayBuffer());
        return { ok: true, pdfBuffer };
    }

    const text = await res.text();
    let log = text;
    try {
        const j = JSON.parse(text);
        log = j.error || j.detail || j.log || text;
    } catch {}
    return { ok: false, log: String(log).slice(0, 8000) };
}

// ── Repair call ──
// One tightly-scoped LLM call that receives the broken LaTeX plus the compiler
// error log and is asked to return corrected full files.

function buildRepairMessages(mainTex: string, referencesBib: string | null, errorLog: string, lang: string): ChatMessage[] {
    const isCyrillic = CYRILLIC_LANGS.has(lang);
    const babelLang = BABEL_LANG_MAP[lang];
    const langNote = isCyrillic
        ? `${babelLang ?? "Russian"} (Cyrillic); ensure T2A fontenc and babel[${babelLang ?? "russian"}] are present`
        : babelLang
            ? `${babelLang}; ensure babel[${babelLang}] is present`
            : "English";
    const system = `You are a LaTeX debugging expert. You will receive a document that failed to compile with pdflatex, along with the compiler's error log. Return corrected files.

Output ONLY valid JSON:
{"main_tex": "…full corrected main.tex…", "references_bib": "…full corrected references.bib, or null if there isn't one…"}

Rules:
- Fix every error the log reports. Do not leave TODO markers.
- Preserve content. Do not paraphrase prose. Minimal surgical edits only.
- Escape specials properly in prose: & → \\&, % → \\%, _ → \\_, # → \\#, $ in prose → \\$.
- Keep braces, environments, and math delimiters balanced.
- Language is ${langNote}.
- Return both files in full. Do not return diffs.
- No markdown fences, no commentary.`;

    const user = [
        `COMPILER ERROR LOG:`,
        errorLog,
        ``,
        `CURRENT main.tex:`,
        mainTex,
        referencesBib ? `\nCURRENT references.bib:\n${referencesBib}` : "",
        ``,
        `Return the JSON with corrected files now.`,
    ].join("\n");

    return [
        { role: "system", content: system },
        { role: "user", content: user },
    ];
}

async function repair(mainTex: string, referencesBib: string | null, errorLog: string, lang: string): Promise<{ mainTex: string; referencesBib: string | null; tokensUsed: number }> {
    const messages = buildRepairMessages(mainTex, referencesBib, errorLog, lang);
    const r = await chatCompletion(messages, { jsonMode: true, timeoutMs: 120_000 });
    const parsed = parseJsonLoose(r.text);

    return {
        mainTex: (parsed.main_tex || mainTex).trim(),
        referencesBib: (parsed.references_bib || referencesBib)?.trim() || null,
        tokensUsed: r.totalTokens,
    };
}

// ── Orchestrator ──

export async function runStage5(
    settings: PipelineSettings,
    assembled: AssembledDoc,
    onAttempt?: (attempt: number, outcome: "ok" | "failed") => void,
): Promise<Stage5Result> {
    let { mainTex, referencesBib } = assembled;
    const visuals = assembled.visuals ?? [];
    const dataFigures = assembled.dataFigures ?? [];
    let tokensUsed = 0;
    let lastLog: string | undefined;

    // Attempt 0 = initial compile. Then up to MAX_REPAIR_ATTEMPTS repair cycles.
    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
        try {
            const r = await compile(mainTex, referencesBib, dataFigures);
            if (!r.ok) {
                lastLog = r.log;
                onAttempt?.(attempt, "failed");
            } else {
                onAttempt?.(attempt, "ok");
                return {
                    compiled: true,
                    repairAttempts: attempt,
                    finalMainTex: mainTex,
                    finalReferencesBib: referencesBib,
                    tokensUsed,
                };
            }
        } catch (e: any) {
            // Infrastructure failure (compiler down, network). Surface and bail -
            // repair won't help if we can't even reach the compiler.
            lastLog = String(e?.message || e);
            break;
        }

        if (attempt === MAX_REPAIR_ATTEMPTS) break;

        try {
            const fixed = await repair(mainTex, referencesBib, lastLog ?? "Unknown error", settings.language);
            mainTex = fixed.mainTex;
            referencesBib = fixed.referencesBib;
            tokensUsed += fixed.tokensUsed;
        } catch (e: any) {
            console.error("[Stage5] Repair failed:", e);
            break;
        }
    }

    return {
        compiled: false,
        repairAttempts: MAX_REPAIR_ATTEMPTS,
        errorLog: lastLog,
        finalMainTex: mainTex,
        finalReferencesBib: referencesBib,
        tokensUsed,
    };
}
