// Orchestrator for the 7-stage generate pipeline.
// Called from /api/agent/generate in a fire-and-forget background task.
// Streams progress updates into agent_sessions.stage_json so the UI can poll.

import type { PipelineSettings, Plan, ExtractedRef, SectionDraft, AssembledDoc, VerificationResult, DocumentDesign } from "./types";
import type { StageProgress } from "../stages";
import type { AgentUpload } from "@/lib/db";
import { runStage1 } from "./stage1_plan";
import { runStage2 } from "./stage2_extract";
import { runStage2_5 } from "./stage2_5_verify";
import { runStage2_7 } from "./stage2_7_enrich_doi";
import { runStage3 } from "./stage3_draft";
import { runStage3_5 } from "./stage3_5_design";
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

export async function runPipeline(input: RunPipelineInput): Promise<RunPipelineOutput> {
    const { settings, uploads, writeProgress } = input;
    let totalTokens = 0;

    let progress: StageProgress = {
        current_stage: 1,
        total_stages: 7,
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
    const { plan, tokensUsed: t1 } = await runStage1(settings, uploads.map(u => u.filename));
    totalTokens += t1;
    await addLog(`Plan generated: ${plan.sections.length} sections, ~${plan.sections.reduce((s, x) => s + x.wordTarget, 0)} words`, "success");
    await addLog(`Document structure: ${plan.sections.map(s => s.heading).join(" → ").slice(0, 100)}...`, "content");

    await updateProgress({
        current_stage: 2,
        label: settings.useReferences && uploads.length > 0
            ? `Extracting from ${uploads.length} file(s)`
            : "Skipping extraction (no references)",
        completed_stages: [1],
        progress: settings.useReferences && uploads.length > 0 ? { done: 0, total: uploads.length } : undefined,
    });

    // ── Stage 2: Extract ──
    const { refs, tokensUsed: t2 } = await runStage2(
        settings,
        plan,
        uploads,
        async (done, total, current) => {
            await updateProgress({
                progress: { done, total },
                label: `Extracting from ${current ?? "file"} (${done}/${total})`,
            });
        },
    );
    totalTokens += t2;
    await addLog(`Extraction complete: ${refs.filter(r => r.status === "ok").length} files processed`, "success");

    // Mark per-file statuses after extraction.
    let fileStatus = new Map(refs.map(r => [r.uploadId, r]));
    progress.files = uploads.map(u => {
        const r = fileStatus.get(u.id);
        if (!r) return { name: u.filename, status: "pending" as const };
        return {
            name: u.filename,
            status: r.status === "ok" ? "ok" : (r.status === "skipped" ? "pending" : "failed"),
            claims: r.keyClaims?.length,
            error: r.error,
        };
    });
    await writeProgress(progress);

    // ── Stage 3: Verify & Enrich ──
    let enrichedRefs = refs;
    let verifications: VerificationResult[] = [];

    if (settings.useReferences && refs.some(r => r.status === "ok")) {
        await updateProgress({
            current_stage: 3,
            label: "Enriching and verifying references",
            completed_stages: [1, 2],
            progress: { done: 0, total: refs.filter(r => r.status === "ok").length },
        });

        // 3a. DOI Enrichment
        const refsWithDoi = refs.filter(r => r.status === "ok" && r.metadata?.doi);
        if (refsWithDoi.length > 0) {
            await addLog(`Found ${refsWithDoi.length} DOIs for enrichment`, "info");
            const { enrichedRefs: enriched, enrichedCount } = await runStage2_7(
                refs,
                async (done, total, current) => {
                    await updateProgress({
                        progress: { done, total },
                        label: `Enriching ${current ?? "reference"} (${done}/${total})`,
                    });
                },
            );
            enrichedRefs = enriched;
            fileStatus = new Map(enrichedRefs.map(r => [r.uploadId, r]));
            if (enrichedCount > 0) {
                await addLog(`DOI enrichment: ${enrichedCount} references improved`, "success");
            }
        }

        // 3b. Verification
        const { verifications: v, tokensUsed: t2_5 } = await runStage2_5(
            enrichedRefs,
            uploads,
            async (done, total, current) => {
                await updateProgress({
                    progress: { done, total },
                    label: `Verifying ${current ?? "reference"} (${done}/${total})`,
                });
            },
        );
        verifications = v;
        totalTokens += t2_5;
        const verifiedCount = verifications.filter(x => x.verified).length;
        await addLog(`Verification: ${verifiedCount}/${verifications.length} sources confirmed`, "success");

        // Update file statuses with verification results
        progress.files = uploads.map(u => {
            const r = fileStatus.get(u.id);
            const v = verifications.find(ver => ver.uploadId === u.id);
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
        await writeProgress(progress);
    } else {
        await updateProgress({ completed_stages: [1, 2, 3] });
    }

    // ── Stage 4: Design ──
    await updateProgress({
        current_stage: 4,
        label: "Designing document layout",
        completed_stages: [1, 2, 3],
        progress: undefined,
    });

    const design = await runStage3_5(settings, plan);
    totalTokens += design.tokensUsed;
    await addLog(`Design applied: ${design.titleBlock.slice(0, 60)}...`, "success");

    // ── Stage 5: Draft (with design context) ──
    await updateProgress({
        current_stage: 5,
        label: `Drafting ${plan.sections.length} section(s)`,
        completed_stages: [1, 2, 3, 4],
        progress: { done: 0, total: plan.sections.length },
    });

    const { sections, tokensUsed: t3, anyTruncated } = await runStage3(
        settings,
        plan,
        enrichedRefs,
        uploads,
        verifications,
        async (done, total, heading) => {
            await addLog(`Drafted: ${heading}`, "content");
            await updateProgress({
                progress: { done, total },
                label: `Drafting ${heading} (${done}/${total})`,
            });
        },
    );
    totalTokens += t3;
    if (anyTruncated) {
        progress.retries = { ...(progress.retries ?? {}), stage_3_truncated: 1 };
    }
    await addLog(`Drafting complete: ~${sections.reduce((s, x) => s + x.wordCount, 0)} words generated`, "success");

    // ── Stage 6: Assemble ──
    await updateProgress({
        current_stage: 6,
        label: "Assembling LaTeX document",
        completed_stages: [1, 2, 3, 4, 5],
    });

    const assembled = runStage4(settings, plan, enrichedRefs, sections, design);
    await addLog(`Assembly complete: ${assembled.mainTex.length} chars, ${assembled.warnings.length} warnings`, "info");

    // ── Stage 7: Validate & Repair ──
    await updateProgress({
        current_stage: 7,
        label: "Validating LaTeX source",
        completed_stages: [1, 2, 3, 4, 5, 6],
    });

    const validated = await runStage5(settings, assembled, async (attempt, outcome) => {
        await updateProgress({
            label: outcome === "ok"
                ? `Compiled on attempt ${attempt + 1}`
                : `Compile failed (attempt ${attempt + 1}), repairing...`,
            retries: { ...(progress.retries ?? {}), repair: attempt + 1 },
        });
        if (outcome !== "ok") {
            await addLog(`Repair attempt ${attempt + 1} started`, "info");
        }
    });
    totalTokens += validated.tokensUsed;

    await updateProgress({
        current_stage: 7,
        label: validated.compiled ? "Done" : "Needs attention",
        completed_stages: [1, 2, 3, 4, 5, 6, 7],
    });

    if (validated.compiled) {
        await addLog("Document ready for download", "success");
    } else {
        await addLog("Document needs attention (compile failed)", "info");
    }

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

