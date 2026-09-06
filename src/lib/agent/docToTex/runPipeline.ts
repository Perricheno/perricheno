// Orchestrator for the Doc-to-TeX conversion pipeline. Deliberately its own
// function rather than a branch inside ../pipeline/index.ts's runPipeline:
// that pipeline is generative (plan from scratch → draft prose → cite
// sources) and this one is transcriptive (preserve source → convert
// verbatim), with a different stage shape (1 formatter + N parallel
// transcribers instead of N sequential drafters). Branching the two inside
// one function would make both harder to read for no shared benefit beyond
// the low-level primitives (llm.ts, compile()), which are imported directly
// instead.

import type { AgentUpload } from "@/lib/db";
import type { StageProgress } from "../stages";
import type { DocToTexSettings, EmbeddedImage } from "./types";
import { planDocument } from "./planner";
import { detectLanguage } from "./detectLanguage";
import { runFormatter } from "./formatter";
import { transcribeChunks } from "./transcriber";
import { assignImagesToChunks, assembleDocToTex } from "./assemble";
import { validateDocToTex } from "./validate";

export type ProgressWriter = (p: StageProgress) => Promise<void>;

export interface RunDocToTexInput {
    settings: DocToTexSettings;
    uploads: AgentUpload[];
    writeProgress: ProgressWriter;
}

export interface RunDocToTexOutput {
    mainTex: string;
    compiled: boolean;
    repairAttempts: number;
    errorLog?: string;
    totalTokens: number;
    status: "done" | "needs_attention";
    warnings: string[];
    pdfBuffer?: Buffer;
}

function normalizeImages(upload: AgentUpload): EmbeddedImage[] {
    let raw: any = (upload as any).images_json;
    if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch { raw = []; }
    }
    return Array.isArray(raw) ? raw : [];
}

export async function runDocToTexPipeline(input: RunDocToTexInput): Promise<RunDocToTexOutput> {
    const { uploads, writeProgress } = input;
    let totalTokens = 0;

    let progress: StageProgress = {
        current_stage: 1,
        total_stages: 4,
        label: "Analyzing document structure",
        completed_stages: [],
        files: uploads.map(u => ({ name: u.filename, status: "pending" as const })),
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        logs: [],
    };
    const update = async (patch: Partial<StageProgress>) => {
        progress = { ...progress, ...patch, updated_at: new Date().toISOString() };
        await writeProgress(progress);
    };
    await writeProgress(progress);

    // Doc-to-TeX takes exactly one source document per session (unlike the
    // report pipeline's multi-reference model) - concatenating multiple
    // uploads' text would defeat heading-based chunking.
    const upload = uploads[0];
    if (!upload) throw new Error("No uploaded document to convert.");

    const text = (upload.text_content || "").trim();
    if (!text) throw new Error("No text could be extracted from the uploaded document.");
    const images = normalizeImages(upload);

    // Auto-detected from the source, not user-supplied - faithful mode never
    // translates, so the document's own script is the only thing that
    // matters for preamble/font selection. Overrides whatever the client sent.
    const settings: DocToTexSettings = { ...input.settings, language: detectLanguage(text) };

    // ── Layer 1: structural plan (deterministic) ──
    const plan = planDocument(text, upload.filename.replace(/\.[^.]+$/, ""));
    await update({ current_stage: 1, label: `Structure detected: ${plan.chunks.length} section(s)`, completed_stages: [1] });

    // ── Layer 2a: document formatting (single call, structure-only input) ──
    await update({ current_stage: 2, label: "Deciding document format", completed_stages: [1] });
    const totalWords = text.split(/\s+/).length;
    const { header, tokensUsed: tFormat } = await runFormatter(plan, settings.templateId, totalWords);
    totalTokens += tFormat;

    // ── Image distribution (deterministic - see assemble.ts for the caveat) ──
    const { byChunk, shims } = assignImagesToChunks(images, plan.chunks);

    // ── Layer 2b: N parallel transcribers, one per chunk ──
    await update({ current_stage: 2, label: `Transcribing ${plan.chunks.length} section(s)`, completed_stages: [1] });
    const { chunks: transcribed, tokensUsed: tTranscribe } = await transcribeChunks(
        plan.chunks, header, settings.mode, settings.language, byChunk,
        async (done, total) => {
            await update({ progress: { done, total }, label: `Transcribing section ${done}/${total}` });
        },
    );
    totalTokens += tTranscribe;
    const failedCount = transcribed.filter(c => c.failed).length;

    // ── Assemble ──
    await update({ current_stage: 3, label: "Assembling LaTeX document", completed_stages: [1, 2] });
    const assembled = assembleDocToTex(settings, header, transcribed, shims);
    if (failedCount > 0) {
        progress = { ...progress, logs: [...(progress.logs || []), { timestamp: Date.now(), message: `${failedCount} section(s) fell back to verbatim quote after a transcription error.`, type: "info" }] };
        await writeProgress(progress);
    }

    // ── Validate & repair ──
    await update({ current_stage: 4, label: "Validating LaTeX source", completed_stages: [1, 2, 3] });
    const validated = await validateDocToTex(assembled.mainTex, assembled.dataFigures, async (attempt, outcome) => {
        await update({
            label: outcome === "ok" ? `Compiled on attempt ${attempt + 1}` : `Repairing attempt ${attempt + 1}...`,
            retries: { ...(progress.retries ?? {}), repair: attempt + 1 },
        });
    });
    totalTokens += validated.tokensUsed;

    await update({ current_stage: 4, label: validated.compiled ? "Done" : "Needs attention", completed_stages: [1, 2, 3, 4] });

    return {
        mainTex: validated.finalMainTex,
        compiled: validated.compiled,
        repairAttempts: validated.repairAttempts,
        errorLog: validated.errorLog,
        totalTokens,
        status: validated.compiled ? "done" : "needs_attention",
        warnings: assembled.warnings,
        pdfBuffer: validated.pdfBuffer,
    };
}
