// Layer 2b - "the one who writes", N agents, one per chunk (owner's explicit
// requirement: scale writer count with document length so no single call
// ever has to hold more than one chunk's worth of source text). Chunks are
// independent by construction (planner.ts cut them at heading boundaries),
// so these calls run in parallel rather than the sequential tail-context
// style the report pipeline's Stage 3 uses - there's no continuity to lose.
//
// Default mode is "faithful": convert markdown → LaTeX, fix table/formula
// syntax, place provided figures - do not paraphrase, shorten, or invent.
// "rewrite" is the same call with a softer style-improvement instruction.

import type { ChatContentPart, ChatMessage } from "../pipeline/llm";
import { chatCompletion, parseJsonLoose } from "../pipeline/llm";
import { concurrentMap } from "../stages";
import type { AssemblyHeader, DocChunk, DocToTexMode, TranscribedChunk } from "./types";

const CONCURRENCY = 4;

export interface ChunkImageAssignment {
    filename: string;   // e.g. "img_3.png" - already the name it will have in figures/ at compile time
    contentType: string;
}

function buildMessages(
    chunk: DocChunk,
    header: AssemblyHeader,
    mode: DocToTexMode,
    images: ChunkImageAssignment[],
    dataUrls: string[],
    language: string,
): ChatMessage[] {
    const headingCmd = chunk.level === 1 && header.useChapters ? "chapter"
        : chunk.level === 1 ? "section"
        : chunk.level === 2 ? (header.useChapters ? "section" : "subsection")
        : "subsubsection";

    const faithfulRule = mode === "faithful"
        ? "Do NOT paraphrase, summarize, shorten, or add anything not in the source. Preserve the exact meaning, order, and level of detail."
        : "You may lightly improve clarity and flow, but preserve the exact meaning and all factual/technical content - this is a style pass, not a rewrite.";

    const figureInstructions = images.length > 0
        ? `\n\nThe following ${images.length} image(s) belong somewhere in this section (already saved as these exact filenames - use them verbatim):\n${images.map(i => `- figures/${i.filename}`).join("\n")}\nInsert one \\begin{figure}[htbp]...\\includegraphics[width=0.8\\linewidth]{figures/<name>}...\\caption{...}...\\end{figure} block per image, placed where it reads naturally given the surrounding text. Write a short, plausible caption from context - the source gave no caption text.`
        : "";

    const system = `You are a precise document-to-LaTeX transcriber. Convert the given markdown-extracted section into a LaTeX body (no \\${headingCmd}{} wrapper - the caller adds that). Output ONLY valid JSON:
{"latex": "…LaTeX body…"}

Rules:
- ${faithfulRule}
- Convert markdown tables to a LaTeX tabular/booktabs table. Convert markdown/plaintext math to proper LaTeX math mode ($...$ or \\[...\\]).
- Escape LaTeX specials in prose: & → \\&, % → \\%, _ → \\_, # → \\#, plain $ → \\$.
- Do not include \\section/\\chapter/\\subsection commands - just the body content.
- Language of the source is ${language}. Keep the source language as-is; do not translate.${figureInstructions}
- No markdown fences, no commentary outside the JSON.`;

    const userParts: ChatContentPart[] = [
        { type: "text", text: `SECTION HEADING (for context only, do not repeat it): ${chunk.heading || "(untitled)"}\n\nSOURCE TEXT:\n${chunk.sourceText}` },
    ];
    for (const url of dataUrls) userParts.push({ type: "image_url", image_url: { url, detail: "low" } });

    return [
        { role: "system", content: system },
        { role: "user", content: userParts },
    ];
}

export async function transcribeChunks(
    chunks: DocChunk[],
    header: AssemblyHeader,
    mode: DocToTexMode,
    language: string,
    imageAssignments: Map<number, { assignment: ChunkImageAssignment; dataUrl: string }[]>,
    onProgress?: (done: number, total: number) => void,
): Promise<{ chunks: TranscribedChunk[]; tokensUsed: number }> {
    let done = 0;
    let tokensUsed = 0;

    const results = await concurrentMap(chunks, CONCURRENCY, async (chunk): Promise<TranscribedChunk> => {
        const assigned = imageAssignments.get(chunk.index) || [];
        try {
            const messages = buildMessages(
                chunk, header, mode,
                assigned.map(a => a.assignment),
                assigned.map(a => a.dataUrl),
                language,
            );
            const r = await chatCompletion(messages, { jsonMode: true, timeoutMs: 120_000 });
            const parsed = parseJsonLoose(r.text);
            tokensUsed += r.totalTokens;
            done++;
            onProgress?.(done, chunks.length);
            return {
                index: chunk.index,
                heading: chunk.heading,
                level: chunk.level,
                latex: (parsed.latex || "").trim(),
                tokensUsed: r.totalTokens,
            };
        } catch (e: any) {
            done++;
            onProgress?.(done, chunks.length);
            return {
                index: chunk.index,
                heading: chunk.heading,
                level: chunk.level,
                latex: `% [Doc-to-TeX: transcription failed for this section - source preserved as a note below]\n\\begin{quote}\n${chunk.sourceText.replace(/[&%$#_{}~^\\]/g, "\\$&").slice(0, 2000)}\n\\end{quote}`,
                tokensUsed: 0,
                failed: true,
                error: String(e?.message || e).slice(0, 300),
            };
        }
    });

    return { chunks: results, tokensUsed };
}
