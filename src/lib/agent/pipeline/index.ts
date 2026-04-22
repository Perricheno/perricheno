// Orchestrator for the 5-stage generate pipeline.
// Called from /api/agent/generate in a fire-and-forget background task.
// Streams progress updates into agent_sessions.stage_json so the UI can poll.

import type { PipelineSettings, Plan, ExtractedRef, SectionDraft, AssembledDoc, VerificationResult } from "./types";
import type { StageProgress } from "../stages";
import type { AgentUpload } from "@/lib/db";
import { runStage1 } from "./stage1_plan";
import { runStage2 } from "./stage2_extract";
import { runStage2_5 } from "./stage2_5_verify";
import { runStage3 } from "./stage3_draft";
import { runStage4 } from "./stage4_assemble";
import { runStage5 } from "./stage5_validate";

export type ProgressWriter = (p: StageProgress) => Promise<void>;

export interface RunPipelineInput {
    settings: PipelineSettings;
    uploads: AgentUpload[];
    writeProgress: ProgressWriter;
}

export interface RunPipelineOutput {
    plan: Plan;
    refs: ExtractedRef[];
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

function touch(p: StageProgress, patch: Partial<StageProgress>): StageProgress {
    return { ...p, ...patch, updated_at: new Date().toISOString() };
}

export async function runPipeline(input: RunPipelineInput): Promise<RunPipelineOutput> {
    const { settings, uploads, writeProgress } = input;
    let totalTokens = 0;

    let progress: StageProgress = {
        current_stage: 1,
        total_stages: 6, // Changed from 5 to 6 (added Stage 2.5)
        label: "Planning document structure",
        completed_stages: [],
        files: uploads.map(u => ({ name: u.filename, status: "pending" as const })),
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    await writeProgress(progress);

    // ── Stage 1: Plan ──
    const { plan, tokensUsed: t1 } = await runStage1(settings, uploads.map(u => u.filename));
    totalTokens += t1;
    progress = touch(progress, {
        current_stage: 2,
        label: settings.useReferences && uploads.length > 0
            ? `Extracting from ${uploads.length} file(s)`
            : "Skipping extraction (no references)",
        completed_stages: [1],
        progress: settings.useReferences && uploads.length > 0 ? { done: 0, total: uploads.length } : undefined,
    });
    await writeProgress(progress);

    // ── Stage 2: Extract ──
    const { refs, tokensUsed: t2 } = await runStage2(
        settings,
        plan,
        uploads,
        async (done, total, current) => {
            progress = touch(progress, {
                progress: { done, total },
                label: `Extracting from ${current ?? "file"} (${done}/${total})`,
            });
            await writeProgress(progress);
        },
    );
    totalTokens += t2;

    // Mark per-file statuses after extraction.
    const fileStatus = new Map(refs.map(r => [r.uploadId, r]));
    progress.files = uploads.map(u => {
        const r = fileStatus.get(u.id);
        if (!r) return { name: u.filename, status: "pending" as const };
        return {
            name: u.filename,
            status: r.status === "ok" ? "ok" : "failed",
            claims: r.keyClaims?.length,
            error: r.error,
        };
    });

    // ── Stage 2.5: Verify (NEW) ──
    let verifications: VerificationResult[] = [];
    if (settings.useReferences && refs.some(r => r.status === "ok")) {
        progress = touch(progress, {
            current_stage: 3,
            label: "Verifying references understanding",
            completed_stages: [1, 2],
            progress: { done: 0, total: refs.filter(r => r.status === "ok").length },
        });
        await writeProgress(progress);

        const { verifications: v, tokensUsed: t2_5 } = await runStage2_5(
            refs,
            uploads,
            async (done: number, total: number, current?: string) => {
                progress = touch(progress, {
                    progress: { done, total },
                    label: `Verifying ${current ?? "reference"} (${done}/${total})`,
                });
                await writeProgress(progress);
            },
        );
        verifications = v;
        totalTokens += t2_5;

        // Update file statuses with verification results
        progress.files = uploads.map(u => {
            const r = fileStatus.get(u.id);
            const v = verifications.find(ver => ver.uploadId === u.id);
            // Map "skipped" to "pending" for UI compatibility
            const mappedStatus = r?.status === "skipped" ? "pending" : (r?.status || "pending");
            return {
                name: u.filename,
                status: mappedStatus as "ok" | "failed" | "pending",
                claims: r?.keyClaims?.length,
                error: r?.error,
                verified: v?.verified,
                verificationScore: v && v.testQuestions.length > 0
                    ? Math.round(v.testQuestions.reduce((sum, q) => sum + q.confidence, 0) / v.testQuestions.length)
                    : undefined,
            };
        });
    }

    progress = touch(progress, {
        current_stage: 4,
        label: `Drafting ${plan.sections.length} section(s)`,
        completed_stages: [1, 2, 3],
        progress: { done: 0, total: plan.sections.length },
    });
    await writeProgress(progress);

    // ── Stage 3: Draft (with enhanced context) ──
    const { sections, tokensUsed: t3, anyTruncated } = await runStage3(
        settings,
        plan,
        refs,
        uploads,
        verifications,
        async (done: number, total: number, heading: string) => {
            progress = touch(progress, {
                progress: { done, total },
                label: `Drafting §${done} ${heading}`,
            });
            await writeProgress(progress);
        },
    );
    totalTokens += t3;

    if (anyTruncated) {
        progress.retries = { ...(progress.retries ?? {}), stage_3_truncated: 1 };
    }

    progress = touch(progress, {
        current_stage: 4,
        label: "Assembling document",
        completed_stages: [1, 2, 3],
        progress: undefined,
    });
    await writeProgress(progress);

    // ── Stage 4: Assemble (no LLM, no tokens) ──
    const assembled = runStage4(settings, plan, refs, sections);

    progress = touch(progress, {
        current_stage: 5,
        label: "Validating LaTeX",
        completed_stages: [1, 2, 3, 4],
    });
    await writeProgress(progress);

    // ── Stage 5: Validate + Repair ──
    const validated = await runStage5(settings, assembled, async (attempt, outcome) => {
        progress = touch(progress, {
            label: outcome === "ok"
                ? `Compiled on attempt ${attempt + 1}`
                : `Compile failed on attempt ${attempt + 1}, repairing`,
            retries: { ...(progress.retries ?? {}), stage_5: attempt + 1 },
        });
        await writeProgress(progress);
    });
    totalTokens += validated.tokensUsed;

    progress = touch(progress, {
        current_stage: 5,
        label: validated.compiled ? "Done" : "Needs attention",
        completed_stages: [1, 2, 3, 4, 5],
    });
    await writeProgress(progress);

    return {
        plan,
        refs,
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
