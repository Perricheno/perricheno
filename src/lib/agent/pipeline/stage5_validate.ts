// Stage 5 - Validate.
// Sends the assembled document to the LaTeX compiler. If compilation fails,
// asks the model to repair only what's broken and retries. Up to 2 repair
// cycles. Final output is whatever compiled last; the orchestrator decides
// whether to surface a "needs_attention" status if the final attempt failed.

import JSZip from "jszip";
import { chatCompletion, parseJsonLoose, type ChatMessage } from "./llm";
import { normalizeLatexText, ensureRussianPreamble, BABEL_LANG_MAP } from "../stages";
import type { AssembledDoc, GeneratedDataFigure, GeneratedVisual, PipelineSettings } from "./types";

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

async function compile(
    mainTex: string,
    referencesBib: string | null,
    visuals: GeneratedVisual[] = [],
    dataFigures: GeneratedDataFigure[] = [],
): Promise<{ ok: true } | { ok: false; log: string }> {
    if (!COMPILER_URL || !COMPILER_KEY) {
        throw new Error("LATEX_COMPILER_URL / LATEX_COMPILER_KEY not configured");
    }

    const zip = new JSZip();
    zip.file("main.tex", mainTex);
    if (referencesBib) zip.file("references.bib", referencesBib);
    for (const v of visuals) {
        if (v.pngBase64) {
            zip.file(`figures/${v.filename}`, Buffer.from(v.pngBase64, "base64"));
        }
    }
    for (const df of dataFigures) {
        if (df.pngBase64) {
            zip.file(`figures/${df.filename}`, Buffer.from(df.pngBase64, "base64"));
        }
    }
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
        // PDF returned - success. Drain the body so sockets close cleanly.
        await res.arrayBuffer();
        return { ok: true };
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
            const r = await compile(mainTex, referencesBib, visuals, dataFigures);
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
