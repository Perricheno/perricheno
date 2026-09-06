// Layer 1 - "the one who gives tasks" (owner's terms). Deterministic, not an
// LLM call: chunk boundaries come from the source document's own markdown
// headings (PaddleOCR-VL preserves these), or - when a source has no
// detectable heading structure - from a fixed word-count window. Per-chunk
// hints (table/formula/list present) come from cheap regex detection.
//
// This is a deliberate departure from feeding the whole document into a
// single "planner" LLM call: that would reintroduce, one layer earlier, the
// exact confusion risk the layer-2 chunking split exists to avoid. Headings
// are ground truth already present in the source - there's nothing for a
// model to usefully infer here that a heading-aware split doesn't already
// give for free, and this path costs zero tokens and can't hallucinate
// structure that isn't there.

import type { ChunkHints, ChunkLevel, DocChunk, DocPlan } from "./types";

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const WORDS_PER_FALLBACK_CHUNK = 900; // conservative - keeps each transcriber call well within a safe context budget

// PaddleOCR-VL's layout-to-markdown conversion marks any visually distinct
// line (bold, centered, prominent) as a heading, not just genuine section
// titles - confirmed live on a real contract, where a bare "г. Астана"
// location line got promoted to a level-3 heading of its own. A real
// section heading is followed by real content; a heading candidate with
// almost nothing under it before the next one is noise, not structure.
const MIN_HEADING_BODY_WORDS = 15;

function wordCount(s: string): number {
    return s.trim().split(/\s+/).filter(Boolean).length;
}

function detectHints(text: string): ChunkHints {
    return {
        hasTable: /^\s*\|.+\|\s*$/m.test(text) || /^\s*\|?[\s:-]+\|[\s:-]+\|?\s*$/m.test(text),
        hasFormula: /\$[^$]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(text),
        hasList: /^\s*[-*+]\s+/m.test(text) || /^\s*\d+\.\s+/m.test(text),
    };
}

function splitByHeadings(text: string): { heading: string; level: ChunkLevel; body: string }[] {
    const lines = text.split("\n");
    const sections: { heading: string; level: ChunkLevel; body: string[] }[] = [
        { heading: "", level: 1, body: [] }, // preamble before the first heading, if any
    ];

    for (const line of lines) {
        const m = line.match(HEADING_RE);
        if (m) {
            const level = m[1].length as ChunkLevel;
            sections.push({ heading: m[2].trim(), level, body: [] });
        } else {
            sections[sections.length - 1].body.push(line);
        }
    }

    const raw = sections
        .map(s => ({ heading: s.heading, level: s.level, body: s.body.join("\n").trim() }))
        .filter(s => s.heading !== "" || s.body !== "");

    return mergeSpuriousHeadings(raw);
}

// Folds a heading whose own body is too short to be real structure into the
// section that follows it, as plain leading text rather than a \section -
// so it renders exactly where it appeared, just not promoted to a heading
// command. Never merges the very last section (nothing to fold it into) or
// the anonymous leading preamble (heading === "").
function mergeSpuriousHeadings(
    sections: { heading: string; level: ChunkLevel; body: string }[],
): { heading: string; level: ChunkLevel; body: string }[] {
    const result: { heading: string; level: ChunkLevel; body: string }[] = [];

    for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const isSpurious = s.heading !== "" && i < sections.length - 1 && wordCount(s.body) < MIN_HEADING_BODY_WORDS;
        if (isSpurious) {
            const folded = [s.heading, s.body].filter(Boolean).join("\n\n");
            sections[i + 1] = { ...sections[i + 1], body: [folded, sections[i + 1].body].filter(Boolean).join("\n\n") };
            continue;
        }
        result.push(s);
    }
    return result;
}

function splitByWordCount(text: string): { heading: string; level: ChunkLevel; body: string }[] {
    const paragraphs = text.split(/\n{2,}/);
    const chunks: { heading: string; level: ChunkLevel; body: string }[] = [];
    let current: string[] = [];
    let wordCount = 0;

    for (const p of paragraphs) {
        const words = p.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 0 && wordCount + words > WORDS_PER_FALLBACK_CHUNK) {
            chunks.push({ heading: "", level: 2, body: current.join("\n\n").trim() });
            current = [];
            wordCount = 0;
        }
        current.push(p);
        wordCount += words;
    }
    if (current.length > 0) chunks.push({ heading: "", level: 2, body: current.join("\n\n").trim() });
    return chunks.length > 0 ? chunks : [{ heading: "", level: 2, body: text.trim() }];
}

export function planDocument(sourceText: string, fallbackTitle: string): DocPlan {
    const text = sourceText.trim();
    const headingMatches = [...text.matchAll(new RegExp(HEADING_RE.source, "gm"))];
    const hasClearHeadings = headingMatches.length >= 2;

    const raw = hasClearHeadings ? splitByHeadings(text) : splitByWordCount(text);

    const chunks: DocChunk[] = raw.map((s, i) => ({
        index: i,
        heading: s.heading,
        level: s.level,
        sourceText: s.body,
        hints: detectHints(s.body),
    }));

    const maxLevel = (chunks.reduce<number>((m, c) => (c.heading ? Math.max(m, c.level) : m), 1) || 1) as ChunkLevel;

    // Title: first heading found, else the caller's fallback (e.g. original filename).
    const title = chunks.find(c => c.heading)?.heading || fallbackTitle;

    return { title, chunks, hasClearHeadings, maxLevel };
}
