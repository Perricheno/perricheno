// Stage 2 — Extract.
// Per-file multimodal extraction. One LLM call per uploaded PDF, in parallel
// with bounded concurrency. Each call receives the PDF's text plus its
// embedded images, and returns a compact JSON summary plus a BibTeX entry.
//
// If a file fails (timeout, parse error, rate-limit), the rest continue —
// Promise.allSettled ensures one bad PDF doesn't tank the whole pipeline.
//
// Skipped entirely when useReferences=false.

import { chatCompletion, parseJsonLoose, type ChatContentPart, type ChatMessage } from "./llm";
import type { ExtractedRef, Plan, PipelineSettings } from "./types";
import type { AgentUpload } from "@/lib/db";
import { concurrentMap, withRetry } from "../stages";

const CONCURRENCY = 4;
// Per-file text cap going into the extractor. 30k chars ~= a 15-20 page paper
// worth of content; the total 200k cap across all uploads is enforced upstream.
const TEXT_CAP_PER_FILE = 30_000;

function slugifyKey(name: string, year?: number): string {
    const base = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "ref";
    return year ? `${base}_${year}` : base;
}

function buildSystemPrompt(sectionHeadings: string[], useRefs: boolean): string {
    return `You are a scientific literature analyst. You read ONE paper (text + figures) and extract compact, structured facts for downstream writing.

Return ONLY valid JSON:
{
  "title": "string",
  "authors": ["Last, First", "..."],
  "year": <integer or null>,
  "venue": "journal/conference name or null",
  "doi": "DOI string or null",
  "key_claims": ["short declarative statements, 5–10 items"],
  "relevant_quotes": ["direct quotes ≤200 chars, 3–6 items"],
  "relevance_score": <integer 0–10 — how relevant to the target sections>,
  "bib_entry": "complete BibTeX block"
}

The document being written will have these sections: ${sectionHeadings.map(h => `"${h}"`).join(", ") || "(unknown)"}.
Focus key_claims and quotes on information useful for those sections.

The bib_entry must:
- Use a stable citation key you invent (lowercase_snake_case, include year if known)
- Be a full @article{…} or @inproceedings{…} or @book{…} block
- Include title, author (use " and " between authors), year, and venue/journal when known
- Include doi = {…} when known

Figures are sent alongside the text. Reference them only if they convey information not in the text.

Do NOT output markdown fences. Do NOT add commentary.`;
}

function userContent(upload: AgentUpload): ChatContentPart[] {
    const parts: ChatContentPart[] = [];
    const text = (upload.text_content || "").slice(0, TEXT_CAP_PER_FILE);
    parts.push({
        type: "text",
        text: `FILE: ${upload.filename}\nPAGES: ${upload.page_count}${upload.ocr_used ? " (OCR)" : ""}\n\nTEXT:\n${text}`,
    });

    const images = Array.isArray(upload.images_json)
        ? upload.images_json
        : (typeof upload.images_json === "string" ? JSON.parse(upload.images_json) : []);

    for (const img of images as { dataUrl: string }[]) {
        if (!img?.dataUrl) continue;
        parts.push({ type: "image_url", image_url: { url: img.dataUrl } });
    }

    return parts;
}

function validateExtraction(raw: any, uploadId: string, filename: string): ExtractedRef {
    if (!raw || typeof raw !== "object") {
        return { uploadId, filename, status: "failed", error: "invalid JSON from extractor" };
    }

    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const year = Number.isFinite(Number(raw.year)) ? Number(raw.year) : undefined;
    const authors = Array.isArray(raw.authors) ? raw.authors.map(String).filter(Boolean) : [];
    const bibKey = typeof raw.bib_entry === "string"
        ? raw.bib_entry.match(/@\w+\s*\{\s*([^,\s]+)/)?.[1] ?? slugifyKey(title || filename, year)
        : slugifyKey(title || filename, year);

    return {
        uploadId,
        filename,
        status: "ok",
        bibKey,
        metadata: {
            title: title || undefined,
            authors: authors.length ? authors : undefined,
            year,
            venue: typeof raw.venue === "string" && raw.venue ? raw.venue : undefined,
            doi: typeof raw.doi === "string" && raw.doi ? raw.doi : undefined,
        },
        keyClaims: Array.isArray(raw.key_claims) ? raw.key_claims.map(String).slice(0, 10) : [],
        relevantQuotes: Array.isArray(raw.relevant_quotes) ? raw.relevant_quotes.map(String).slice(0, 6) : [],
        relevanceScore: Number.isFinite(Number(raw.relevance_score))
            ? Math.max(0, Math.min(10, Math.round(Number(raw.relevance_score))))
            : undefined,
        bibEntry: typeof raw.bib_entry === "string" ? raw.bib_entry.trim() : "",
    };
}

export async function runStage2(
    settings: PipelineSettings,
    plan: Plan,
    uploads: AgentUpload[],
    onProgress?: (done: number, total: number, current?: string) => void,
): Promise<{ refs: ExtractedRef[]; tokensUsed: number }> {
    if (!settings.useReferences || uploads.length === 0) {
        return { refs: [], tokensUsed: 0 };
    }

    const sectionHeadings = plan.sections.map(s => s.heading);
    const systemPrompt = buildSystemPrompt(sectionHeadings, settings.useReferences);
    let totalTokens = 0;
    let completed = 0;

    const results = await concurrentMap(uploads, CONCURRENCY, async (upload) => {
        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent(upload) },
        ];

        try {
            const r = await withRetry(() => chatCompletion(messages, {
                jsonMode: true,
                maxTokens: 2500,
                temperature: 0.2,
                timeoutMs: 90_000,
            }), 2, 1000);

            totalTokens += r.totalTokens;
            const parsed = parseJsonLoose(r.text);
            const ref = validateExtraction(parsed, upload.id, upload.filename);
            ref.tokensUsed = r.totalTokens;
            return ref;
        } catch (e: any) {
            return {
                uploadId: upload.id,
                filename: upload.filename,
                status: "failed",
                error: String(e?.message || e).slice(0, 200),
            } as ExtractedRef;
        } finally {
            completed++;
            onProgress?.(completed, uploads.length, upload.filename);
        }
    });

    return { refs: results, tokensUsed: totalTokens };
}
