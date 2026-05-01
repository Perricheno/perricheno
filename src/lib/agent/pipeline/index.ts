// Orchestrator for the 6-stage generate pipeline.
// Called from /api/agent/generate in a fire-and-forget background task.
// Streams progress updates into agent_sessions.stage_json so the UI can poll.

import type { PipelineSettings, Plan, ExtractedRef, SectionDraft, AssembledDoc, VerificationResult } from "./types";
import type { StageProgress } from "../stages";
import type { AgentUpload } from "@/lib/db";
import { runStage1 } from "./stage1_plan";
import { runStage2 } from "./stage2_extract";
import { runStage2_5 } from "./stage2_5_verify";
import { runStage2_7 } from "./stage2_7_enrich_doi";
import { runStage3 } from "./stage3_draft";
import { runStage4 } from "./stage4_assemble";
import { runStage5 } from "./stage5_validate";
import { withRetry } from "../stages";

export type ProgressWriter = (p: StageProgress) => Promise<void>;

export interface RunPipelineInput {
    settings: PipelineSettings;
    uploads: AgentUpload[];
    writeProgress: ProgressWriter;
}

export interface RunPipelineOutput {
    plan: Plan;
    refs: ExtractedRef[];
    verifications: VerificationResult[];
    sections: SectionDraft[];
    assembled: AssembledDoc;
    mainTex: string;
    referencesBib: string | null;
    compiled: boolean;
    repairAttempts: number;
    errorLog?: string;
    totalTokens: number;
    status: "done" | "needs_attention";
}

export async function runPipeline(input: RunPipelineInput): Promise<RunPipelineOutput> {
    const { settings, uploads, writeProgress } = input;
    let totalTokens = 0;

    let progress: StageProgress = {
        current_stage: 1,
        total_stages: 6,
        label: "Planning document structure",
        completed_stages: [],
        files: uploads.map(u => ({ name: u.filename, status: "pending" as const })),
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        logs: [],
    };

    const updateProgress = async (patch: Partial<StageProgress>) => {
        progress = { ...progress, ...patch, updated_at: new Date().toISOString() };
        await writeProgress(progress);
    };

    const addLog = async (message: string, type: "info" | "success" | "content" = "info") => {
        progress = { 
            ...progress, 
            logs: [...(progress.logs || []), { timestamp: Date.now(), message, type }].slice(-10) 
        };
        await writeProgress(progress);
    };

    await writeProgress(progress);

    // ── Stage 1: Plan ──
    const { plan, tokensUsed: t1 } = await withRetry(() => runStage1(settings, uploads.map(u => u.filename)), 3, 1000);
    totalTokens += t1;
    await addLog(`Plan generated: ${plan.sections.length} sections`, "success");

    await updateProgress({
        current_stage: 2,
        label: settings.useReferences && uploads.length > 0 ? `Extracting from ${uploads.length} file(s)` : "Skipping extraction",
        completed_stages: [1],
    });

    // ── Stage 2: Extract ──
    const { refs, tokensUsed: t2 } = await runStage2(
        settings,
        plan,
        uploads,
        async (done, total, current) => {
            await updateProgress({ progress: { done, total }, label: `Extracting ${current ?? "file"} (${done}/${total})` });
        },
    );
    totalTokens += t2;

    // ── Stage 3: Verify & Enrich ──
    let enrichedRefs = refs;
    let verifications: VerificationResult[] = [];

    if (settings.useReferences && refs.some(r => r.status === "ok")) {
        await updateProgress({
            current_stage: 3,
            label: "Enriching and verifying references",
            completed_stages: [1, 2],
        });

        // 3a. DOI Enrichment
        const { enrichedRefs: enriched } = await runStage2_7(refs);
        enrichedRefs = enriched;

        // 3b. Verification
        const { verifications: v, tokensUsed: t2_5 } = await runStage2_5(enrichedRefs, uploads);
        verifications = v;
        totalTokens += t2_5;
    }

    // ── Stage 4: Draft ──
    await updateProgress({
        current_stage: 4,
        label: `Drafting ${plan.sections.length} section(s)`,
        completed_stages: [1, 2, 3],
    });

    const { sections, tokensUsed: t3 } = await withRetry(() => runStage3(
        settings,
        plan,
        enrichedRefs,
        uploads,
        verifications,
        async (done, total, heading) => {
            await updateProgress({ progress: { done, total }, label: `Drafting ${heading} (${done}/${total})` });
        },
    ), 2, 2000);
    totalTokens += t3;

    // ── Stage 5: Assemble ──
    await updateProgress({
        current_stage: 5,
        label: "Assembling LaTeX document",
        completed_stages: [1, 2, 3, 4],
    });

    const assembled = runStage4(settings, plan, enrichedRefs, sections);
    await addLog("Assembly complete", "success");

    // ── Stage 6: Validate & Repair ──
    await updateProgress({
        current_stage: 6,
        label: "Validating LaTeX source",
        completed_stages: [1, 2, 3, 4, 5],
    });

    const validated = await runStage5(settings, assembled, async (attempt, outcome) => {
        await updateProgress({
            label: outcome === "ok" ? `Compiled on attempt ${attempt + 1}` : `Repairing attempt ${attempt + 1}...`,
            retries: { ...(progress.retries ?? {}), repair: attempt + 1 },
        });
    });
    totalTokens += validated.tokensUsed;

    await updateProgress({
        current_stage: 6,
        label: validated.compiled ? "Done" : "Needs attention",
        completed_stages: [1, 2, 3, 4, 5, 6],
    });

    return {
        plan,
        refs: enrichedRefs,
        verifications,
        sections,
        assembled,
        mainTex: validated.finalMainTex,
        referencesBib: validated.finalReferencesBib,
        compiled: validated.compiled,
        repairAttempts: validated.repairAttempts,
        errorLog: validated.errorLog,
        totalTokens,
        status: validated.compiled ? "done" : "needs_attention",
    };
}
