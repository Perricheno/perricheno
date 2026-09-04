// Job processor for the analytics pipeline (analytics-generate). Extracted
// from src/app/api/agent/analytics/generate/route.ts (Phase 6a) - see
// reportGenerate.ts for the rationale (survive a worker/web restart, not just
// a client disconnect).

import { checkAndDeductUsage, getAgentUploadsByIds, updateAgentSession, getAgentSession } from '@/lib/db';
import { runAnalyticsPipeline } from '@/lib/analytics/pipeline';
import { saveFilesToDisk, deleteFiles } from '@/lib/analytics/fileManager';
import type { AnalyticsSettings } from '@/lib/analytics/pipeline/types';
import type { StageProgress } from '@/lib/agent/stages';

export interface AnalyticsGenerateJobData {
    sessionId: string;
    userId: number;
    settings: AnalyticsSettings;
}

export async function runAnalyticsGenerate({ sessionId, userId, settings }: AnalyticsGenerateJobData): Promise<void> {
    const existing = await getAgentSession(sessionId);
    if (!existing || existing.status !== 'generating') {
        console.log(`[analytics-generate] session ${sessionId} already left 'generating' (${existing?.status}) - skipping duplicate delivery`);
        return;
    }

    try {
        console.log(`[Analytics-BG] Starting pipeline for session ${sessionId}`);

        // Get uploads
        const uploads = await getAgentUploadsByIds(settings.uploadIds, userId);

        if (uploads.length === 0) {
            throw new Error("No uploads found");
        }

        // Save files to shared volume for R/Python compilers
        console.log(`[Analytics-BG] Saving ${uploads.length} files to disk...`);
        const fileMap = await saveFilesToDisk(uploads);
        const savedFiles = Array.from(fileMap.values());

        // CRITICAL: Clear text_content to avoid sending huge data to OpenAI
        // Files are now on disk, accessible by compilers
        uploads.forEach(u => {
            u.text_content = null;
        });

        // Progress writer
        const writeProgress = async (p: StageProgress) => {
            await updateAgentSession(sessionId, {
                stage_json: JSON.stringify(p),
            });
        };

        let result;
        try {
            // Run pipeline with fileMap
            result = await runAnalyticsPipeline({
                settings,
                uploads,
                writeProgress,
                fileMap, // Pass fileMap to pipeline
            });

            // Clean up files after pipeline completes
            await deleteFiles(savedFiles);
            console.log(`[Analytics-BG] Cleaned up ${savedFiles.length} temporary files`);
        } catch (error) {
            // Clean up files even if pipeline fails
            await deleteFiles(savedFiles);
            throw error;
        }

        // Deduct usage
        await checkAndDeductUsage(userId, 'chars', result.totalTokens * 3);  // tokens → chars
        await checkAndDeductUsage(userId, 'visuals', result.charts.length);

        // Save results
        await updateAgentSession(sessionId, {
            status: result.status === 'done' ? 'done' : 'needs_attention',
            visuals_json: JSON.stringify(result.charts),
            settings_json: JSON.stringify({
                ...settings,
                verifications: result.verifications,
                chartPlans: result.chartPlans,
            }),
        });

        console.log(`[Analytics-BG] Pipeline complete for ${sessionId}: ${result.charts.length} charts`);

    } catch (err: any) {
        console.error(`[Analytics-BG] Pipeline failed for ${sessionId}:`, err);

        await updateAgentSession(sessionId, {
            status: 'error',
            error_msg: err?.message || 'Pipeline failed',
        });
    }
}
