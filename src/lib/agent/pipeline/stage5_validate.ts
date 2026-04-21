// Stage 5 — Validate.
// Sends the assembled document to the LaTeX compiler. If compilation fails,
// asks the model to repair only what's broken and retries. Up to 2 repair
// cycles. Final output is whatever compiled last; the orchestrator decides
// whether to surface a "needs_attention" status if the final attempt failed.

import JSZip from "jszip";
import { chatCompletion, parseJsonLoose, type ChatMessage } from "./llm";
import { normalizeLatexText, ensureRussianPreamble } from "../stages";
import type { AssembledDoc, PipelineSettings } from "./types";

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

async function compile(mainTex: string, referencesBib: string | null): Promise<{ ok: true } | { ok: false; log: string }> {
    if (!COMPILER_URL || !COMPILER_KEY) {
        throw new Error("LATEX_COMPILER_URL / LATEX_COMPILER_KEY not configured");
    }

    const zip = new JSZip();
    zip.file("main.tex", mainTex);
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
        // PDF returned — success. Drain the body so sockets close cleanly.
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

function buildRepairMessages(mainTex: string, referencesBib: string | null, errorLog: string, lang: "en" | "ru"): ChatMessage[] {
    const system = `You are a LaTeX debugging expert. You will receive a document that failed to compile with pdflatex, along with the compiler's error log. Return corrected files.

Output ONLY valid JSON:
{"main_tex": "…full corrected main.tex…", "references_bib": "…full corrected references.bib, or null if there isn't one…"}

Rules:
- Fix every error the log reports. Do not leave TODO markers.
- Preserve content. Do not paraphrase prose. Minimal surgical edits only.
- Escape specials properly in prose: & → \\&, % → \\%, _ → \\_, # → \\#.
- Keep braces, environments, and math delimiters balanced.
- Language is ${lang === "ru" ? "Russian; ensure T2A fontenc and babel[russian] are present" : "English"}.
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
        `Return the corrected JSON now.`,
    ].filter(Boolean).join("\n");

    return [
        { role: "system", content: system },
        { role: "user", content: user },
    ];
}

async function repair(mainTex: string, referencesBib: string | null, errorLog: string, lang: "en" | "ru"):
    Promise<{ mainTex: string; referencesBib: string | null; tokens: number }> {
    const r = await chatCompletion(buildRepairMessages(mainTex, referencesBib, errorLog, lang), {
        jsonMode: true,
        maxTokens: 16_000,
        temperature: 0.1,
        timeoutMs: 180_000,
    });

    const parsed: any = parseJsonLoose(r.text);
    if (!parsed || typeof parsed.main_tex !== "string") {
        throw new Error("Repair model returned invalid JSON");
    }

    let fixedMain = normalizeLatexText(parsed.main_tex);
    fixedMain = ensureRussianPreamble(fixedMain, lang);
    const fixedBib = (typeof parsed.references_bib === "string" && parsed.references_bib.trim())
        ? normalizeLatexText(parsed.references_bib)
        : null;

    return { mainTex: fixedMain, referencesBib: fixedBib, tokens: r.totalTokens };
}

// ── Orchestrated stage ──

export async function runStage5(
    settings: PipelineSettings,
    assembled: AssembledDoc,
    onAttempt?: (attempt: number, outcome: "ok" | "failed") => void,
): Promise<Stage5Result> {
    let mainTex = assembled.mainTex;
    let referencesBib = assembled.referencesBib;
    let tokensUsed = 0;
    let lastLog: string | undefined;

    // Attempt 0 = initial compile. Then up to MAX_REPAIR_ATTEMPTS repair cycles.
    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
        try {
            const r = await compile(mainTex, referencesBib);
            if (r.ok) {
                onAttempt?.(attempt, "ok");
                return {
                    compiled: true,
                    repairAttempts: attempt,
                    finalMainTex: mainTex,
                    finalReferencesBib: referencesBib,
                    tokensUsed,
                };
            }
            lastLog = r.log;
            onAttempt?.(attempt, "failed");
        } catch (e: any) {
            // Infrastructure failure (compiler down, network). Surface and bail —
            // repair won't help if we can't even reach the compiler.
            lastLog = String(e?.message || e);
            break;
        }

        if (attempt === MAX_REPAIR_ATTEMPTS) break;

        try {
            const fixed = await repair(mainTex, referencesBib, lastLog, settings.language);
            mainTex = fixed.mainTex;
            referencesBib = fixed.referencesBib;
            tokensUsed += fixed.tokens;
        } catch (e: any) {
            // Repair itself broke; fall through to returning the best-so-far.
            console.warn("[Stage5] Repair call failed:", e?.message);
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
