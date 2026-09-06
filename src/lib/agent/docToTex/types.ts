// Shared types for the Doc-to-TeX conversion pipeline. Deliberately separate
// from ../pipeline/types.ts: this is a transcription pipeline (preserve the
// source), not a generative one, and forcing it through the same Plan/
// SectionDraft shapes used for report generation would blur two very
// different jobs. See docs/plans/doc-to-tex for the full spec.

export type DocToTexMode = "faithful" | "rewrite";

export interface DocToTexSettings {
    uploadIds: string[];
    mode: DocToTexMode;
    templateId: string;                 // preset id from templates/presets.ts, or "custom"
    customTemplatePreamble?: string;
    language: string;                   // iso-639-1, e.g. "en" | "ru" | "kk" - auto-detected from the source in runPipeline.ts, not user-supplied
    authorName?: string;
    courseName?: string;
    dateStr?: string;
    groupName?: string;
    supervisorName?: string;
}

export type ChunkLevel = 1 | 2 | 3;

// A per-chunk hint set, detected deterministically (regex) rather than by an
// LLM call - cheap, reliable, and gives the transcriber a heads-up about what
// kind of content it's converting without needing to re-derive it itself.
export interface ChunkHints {
    hasTable: boolean;
    hasFormula: boolean;
    hasList: boolean;
}

export interface DocChunk {
    index: number;
    heading: string;          // "" for a leading chunk with no heading of its own
    level: ChunkLevel;
    sourceText: string;       // raw extracted markdown for this chunk, untouched
    hints: ChunkHints;
}

export interface DocPlan {
    title: string;
    chunks: DocChunk[];
    hasClearHeadings: boolean;
    maxLevel: ChunkLevel;     // deepest heading level actually seen in the source
}

// Layer 2a output - one call for the whole document, deciding document-level
// shape. All N layer-2b transcribers receive this as a shared contract so
// they don't diverge on heading depth / title-page handling.
export interface AssemblyHeader {
    useChapters: boolean;     // \chapter for level-1 headings (report-class docs)
    needsTitlePage: boolean;
    needsToc: boolean;
    title: string;
}

export interface EmbeddedImage {
    dataUrl: string;
    contentType: string;
    bytes: number;
}

export interface TranscribedChunk {
    index: number;
    heading: string;
    level: ChunkLevel;
    latex: string;            // body only - no \chapter{}/\section{} wrapper
    tokensUsed: number;
    failed?: boolean;
    error?: string;
}

export interface DocToTexResult {
    mainTex: string;
    referencesBib: null;      // Doc-to-TeX never generates citations
    compiled: boolean;
    repairAttempts: number;
    errorLog?: string;
    totalTokens: number;
    status: "done" | "needs_attention";
}
