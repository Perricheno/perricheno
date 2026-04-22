// Analytics Pipeline Orchestrator
// Coordinates all 3 stages with progress tracking

import type { AnalyticsSettings, AnalyticsPipelineResult } from "./types";
import type { AgentUpload } from "@/lib/db";
import type { StageProgress } from "@/lib/agent/stages";
import { runStage1 } from "./stage1_verify_data";
import { runStage2 } from "./stage2_plan_charts";
import { runStage3 } from "./stage3_generate";

export type ProgressWriter = (p: StageProgress) => Promise<void>;

export interface RunAnalyticsPipelineInput {
    settings: AnalyticsSettings;
    uploads: AgentUpload[];
    writeProgress: ProgressWriter;
}

function touch(p: StageProgress, patch: Partial<StageProgress>): StageProgress {
    return { ...p, ...patch, updated_at: new Date().toISOString() };
}

export async function runAnalyticsPipeline(
    input: RunAnalyticsPipelineInput
): Promise<AnalyticsPipelineResult> {
    const { settings, uploads, writeProgress } = input;
    let totalTokens = 0;

    let progress: StageProgress = {
        current_stage: 1,
        total_stages: 3,
        label: "Verifying data quality",
        completed_stages: [],
        files: uploads.map(u => ({ name: u.filename, status: "pending" as const })),
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    await writeProgress(progress);

    // ── Stage 1: Verify Data ──
    console.log(`[Analytics-Pipeline] Starting Stage 1: Data Verification`);
    
    const { verifications, tokensUsed: t1 } = await runStage1(
        uploads,
        async (done, total, current) => {
            progress = touch(progress, {
                progress: { done, total },
                label: `Verifying ${current ?? "file"} (${done}/${total})`,
            });
            await writeProgress(progress);
        }
    );
    totalTokens += t1;

    // Update file statuses with verification results
    progress.files = uploads.map(u => {
        const v = verifications.find(ver => ver.uploadId === u.id);
        return {
            name: u.filename,
            status: v?.verified ? "ok" : "failed",
            verified: v?.verified,
            verificationScore: v?.verified ? 10 : 0,
            error: v?.warnings.join("; "),
        };
    });

    progress = touch(progress, {
        current_stage: 2,
        label: "Planning visualizations",
        completed_stages: [1],
        progress: undefined,
    });
    await writeProgress(progress);

    // ── Stage 2: Plan Charts ──
    console.log(`[Analytics-Pipeline] Starting Stage 2: Chart Planning`);
    
    const { plans, tokensUsed: t2 } = await runStage2(
        settings,
        verifications,
        uploads
    );
    totalTokens += t2;

    progress = touch(progress, {
        current_stage: 3,
        label: `Generating ${plans.length} visualization(s)`,
        completed_stages: [1, 2],
        progress: { done: 0, total: plans.length },
    });
    await writeProgress(progress);

    // ── Stage 3: Generate Charts ──
    console.log(`[Analytics-Pipeline] Starting Stage 3: Chart Generation`);
    
    const { charts, tokensUsed: t3 } = await runStage3(
        plans,
        verifications,
        uploads,
        settings.runtime,
        async (done, total, chartType) => {
            progress = touch(progress, {
                progress: { done, total },
                label: `Generating ${chartType} (${done}/${total})`,
            });
            await writeProgress(progress);
        }
    );
    totalTokens += t3;

    progress = touch(progress, {
        current_stage: 3,
        label: `Complete: ${charts.length} visualization(s) generated`,
        completed_stages: [1, 2, 3],
        progress: { done: charts.length, total: plans.length },
    });
    await writeProgress(progress);

    const status = charts.length === plans.length 
        ? 'done' 
        : charts.length > 0 
            ? 'partial' 
            : 'failed';

    console.log(`[Analytics-Pipeline] Pipeline complete: ${charts.length}/${plans.length} charts, ${totalTokens} tokens, status=${status}`);

    return {
        verifications,
        chartPlans: plans,
        charts,
        totalTokens,
        status,
    };
}
