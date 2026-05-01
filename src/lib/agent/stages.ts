// Utilities shared across the staged agent pipeline.
// All of this is pure string / control-flow logic - no network, no DB.

// ── Retry with exponential backoff ──

export async function withRetry<T>(
    fn: () => Promise<T>,
    attempts = 3,
    baseDelayMs = 600,
): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i === attempts - 1) break;
            const delay = baseDelayMs * Math.pow(2, i) + Math.random() * 200;
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

// ── Bounded-concurrency map ──
// Runs `fn` over `items` with at most `limit` in flight. Preserves input order.

export async function concurrentMap<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const idx = cursor++;
            if (idx >= items.length) return;
            results[idx] = await fn(items[idx], idx);
        }
    });

    await Promise.all(workers);
    return results;
}

// ── UTF-8 normalizer for LaTeX output ──
// Fixes the common ways an LLM returns text that pdflatex chokes on.

export function normalizeLatexText(raw: string): string {
    if (!raw) return raw;

    let s = raw;

    // Canonical composition - e.g. 'e' + COMBINING ACUTE ACCENT → é.
    s = s.normalize("NFC");

    // Strip BOM and zero-width spaces/joiners.
    s = s.replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, "");

    // Strip control characters except \t, \n, \r.
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

    // Non-breaking space → LaTeX tie. NBSP is a frequent copy-paste artifact.
    s = s.replace(/\u00A0/g, "~");

    // Smart quotes / typographic punctuation → LaTeX-friendly.
    s = s
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/\u2026/g, "...")
        .replace(/\u2013/g, "--")
        .replace(/\u2014/g, "---")
        .replace(/\u2212/g, "-");

    // Strip any leftover unpaired surrogates.
    s = s.replace(/[\uD800-\uDFFF]/g, "");

    return s;
}

// Shared iso-639-1 → babel language name mapping.
export const BABEL_LANG_MAP: Record<string, string> = {
    ru: "russian",    uk: "ukrainian", kk: "kazakh",    bg: "bulgarian",
    sr: "serbian",    mk: "macedonian", be: "belarusian",
    de: "german",     fr: "french",    es: "spanish",   it: "italian",
    pt: "portuguese", nl: "dutch",     pl: "polish",    cs: "czech",
    sk: "slovak",     hu: "hungarian", ro: "romanian",  el: "greek",
    tr: "turkish",    sv: "swedish",   no: "norsk",     da: "danish",
    fi: "finnish",    en: "english",
};

const CYRILLIC_LANGS = new Set(["ru", "uk", "kk", "bg", "sr", "mk", "be"]);

// ── Language-package injection ──
// If the document contains Cyrillic (or targets a Cyrillic-script language)
// but the preamble is missing T2A / babel, inject the packages non-destructively.

export function ensureRussianPreamble(tex: string, language: string): string {
    const hasCyrillic = /[\u0400-\u04FF]/.test(tex);
    if (language === "kk") return tex; // XeLaTeX handled in Stage 4
    if (!hasCyrillic && !CYRILLIC_LANGS.has(language)) return tex;

    const hasT2A = /\\usepackage\s*\[[^\]]*T2A[^\]]*\]\s*\{fontenc\}/.test(tex);
    const hasBabel = /\\usepackage\s*\[[^\]]*\]\s*\{babel\}/.test(tex);
    const hasInputenc = /\\usepackage\s*\[[^\]]*utf8[^\]]*\]\s*\{inputenc\}/.test(tex);
    if (hasT2A && hasBabel && hasInputenc) return tex;

    const babelLang = BABEL_LANG_MAP[language] ?? "russian";
    const additions: string[] = [];
    if (!hasInputenc) additions.push("\\usepackage[utf8]{inputenc}");
    if (!hasT2A)      additions.push("\\usepackage[T2A]{fontenc}");
    if (!hasBabel)    additions.push(`\\usepackage[${babelLang},english]{babel}`);

    const block = additions.join("\n") + "\n";
    const m = tex.match(/\\documentclass[^\n]*\n/);
    if (!m) return block + tex;
    const idx = (m.index ?? 0) + m[0].length;
    return tex.slice(0, idx) + block + tex.slice(idx);
}

// ── Escape sanity check ──
// Flags unescaped specials inside prose (best-effort - LaTeX is context-sensitive).
// Returns a list of offending line numbers; use for logging, not auto-rewriting.

const SPECIAL_UNESCAPED = /(?<!\\)[&%#_$]/g;

export function findUnescapedSpecials(tex: string): number[] {
    const lines = tex.split("\n");
    const hits: number[] = [];
    let inVerbatim = false;
    let inCode = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\\begin\s*\{verbatim\}|\\begin\s*\{lstlisting\}|\\begin\s*\{minted\}/.test(line)) inVerbatim = true;
        if (/\\end\s*\{verbatim\}|\\end\s*\{lstlisting\}|\\end\s*\{minted\}/.test(line)) inVerbatim = false;

        // math-mode lines we skip - $ balances are checked elsewhere.
        if (inVerbatim) continue;

        SPECIAL_UNESCAPED.lastIndex = 0;
        if (SPECIAL_UNESCAPED.test(line)) hits.push(i + 1);
    }
    return hits;
}

// ── Brace / environment balance ──

export interface StructureIssues {
    unbalancedBraces: number;      // open - close; 0 = ok
    mismatchedEnvs: string[];      // env names that don't pair
}

export function checkLatexStructure(tex: string): StructureIssues {
    // Brace count (ignoring escaped \{ \})
    let depth = 0;
    let min = 0;
    for (let i = 0; i < tex.length; i++) {
        const c = tex[i];
        const prev = i > 0 ? tex[i - 1] : "";
        if (prev === "\\") continue;
        if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth < min) min = depth; }
    }

    // Env balance
    const envStack: string[] = [];
    const mismatched = new Set<string>();
    const envRe = /\\(begin|end)\s*\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = envRe.exec(tex))) {
        const [, kind, name] = m;
        if (kind === "begin") envStack.push(name);
        else {
            const top = envStack.pop();
            if (top !== name) mismatched.add(name);
        }
    }
    for (const leftover of envStack) mismatched.add(leftover);

    return { unbalancedBraces: depth, mismatchedEnvs: Array.from(mismatched) };
}

// ── Citation ↔ bib reconciliation ──

export function findUnresolvedCitations(tex: string, bib: string | null): string[] {
    if (!bib) return [];
    const citeRe = /\\(?:cite|textcite|parencite|citep|citet|autocite)\s*\{([^}]+)\}/g;
    const bibKeys = new Set<string>();
    const bibRe = /@\w+\s*\{\s*([^,\s]+)\s*,/g;
    let m: RegExpExecArray | null;
    while ((m = bibRe.exec(bib))) bibKeys.add(m[1]);

    const missing = new Set<string>();
    while ((m = citeRe.exec(tex))) {
        for (const key of m[1].split(",").map(s => s.trim()).filter(Boolean)) {
            if (!bibKeys.has(key)) missing.add(key);
        }
    }
    return Array.from(missing);
}

// ── Stage progress helper ──
// Shape persisted to agent_sessions.stage_json; read by the UI poller.

export interface StageProgress {
    current_stage: number;
    total_stages: number;
    label: string;
    progress?: { done: number; total: number };
    completed_stages: number[];
    files?: { 
        name: string; 
        status: "ok" | "failed" | "pending"; 
        claims?: number; 
        error?: string;
        verified?: boolean;           // NEW: Stage 2.5 verification passed
        verificationScore?: number;   // NEW: Average confidence score (0-10)
    }[];
    retries?: Record<string, number>;
    started_at: string;
    updated_at: string;
    logs?: { timestamp: number; message: string; type?: "info" | "success" | "content" }[];
}

export function initProgress(totalStages: number): StageProgress {
    const now = new Date().toISOString();
    return {
        current_stage: 0,
        total_stages: totalStages,
        label: "Queued",
        completed_stages: [],
        started_at: now,
        updated_at: now,
    };
}
