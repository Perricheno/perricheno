// Job processor for 'doc-to-tex-convert'. Mirrors reportGenerate.ts's shape
// (idempotency guard, progress writer, final persist, token billing) but
// drives runDocToTexPipeline instead of the generative runPipeline.

import {
    getAgentSession, updateAgentSession,
    checkAndDeductUsage, getAgentUploadsByIds,
} from '@/lib/db';
import { uploadToStorage } from '@/lib/storage';
import { runDocToTexPipeline } from '@/lib/agent/docToTex/runPipeline';
import type { DocToTexSettings } from '@/lib/agent/docToTex/types';

export interface DocToTexConvertJobData {
    sessionId: string;
    userId: number;
    settings: DocToTexSettings;
}

export async function runDocToTexConvert({ sessionId, userId, settings }: DocToTexConvertJobData): Promise<void> {
    // Same idempotency guard as report-generate: a redelivered job (worker
    // crash mid-run) skips re-running once a previous attempt already moved
    // the session off 'generating'.
    const existing = await getAgentSession(sessionId);
    if (!existing || existing.status !== 'generating') {
        console.log(`[doc-to-tex-convert] session ${sessionId} already left 'generating' (${existing?.status}) - skipping duplicate delivery`);
        return;
    }

    try {
        const uploads = await getAgentUploadsByIds(settings.uploadIds, userId);

        const writeProgress = async (progress: any) => {
            await updateAgentSession(sessionId, { stage_json: progress });
        };

        const result = await runDocToTexPipeline({ settings, uploads, writeProgress });

        // Persist the compiled PDF so the result page can offer a direct
        // download without recompiling (the source images that went into it
        // live in the ephemeral 24h AgentUpload, not on the session).
        let pdfStoragePath: string | null = null;
        if (result.pdfBuffer) {
            try {
                const pdfFile = new File([new Uint8Array(result.pdfBuffer)], 'document.pdf', { type: 'application/pdf' });
                const stored = await uploadToStorage(userId, pdfFile);
                pdfStoragePath = stored.path;
            } catch (e) {
                console.error('[doc-to-tex-convert] PDF storage upload failed (non-fatal):', e);
            }
        }

        await updateAgentSession(sessionId, {
            status: result.status,
            main_tex: result.mainTex,
            references_bib: null,
            stream_text: null,
            error_msg: result.compiled ? null : (result.errorLog?.slice(0, 500) ?? 'Compilation unresolved after retries'),
        });

        if (pdfStoragePath) {
            const latest = await getAgentSession(sessionId);
            let stage: any = {};
            try { stage = latest?.stage_json ? JSON.parse(latest.stage_json as unknown as string) : {}; } catch { stage = {}; }
            await updateAgentSession(sessionId, { stage_json: { ...stage, pdf_storage_path: pdfStoragePath } });
        }

        if (result.totalTokens > 0) {
            // Same token→char conversion the report pipeline uses. Doc-to-TeX's
            // input/output profile is inverted (large input, moderate output) -
            // flagged for a separate calibration pass, not blocking here.
            await checkAndDeductUsage(userId, 'chars', result.totalTokens * 3);
        }
    } catch (err: any) {
        console.error('[doc-to-tex-convert] job error:', err);
        await updateAgentSession(sessionId, {
            status: 'error',
            error_msg: String(err?.message || err).slice(0, 500),
            stream_text: null,
        });
    }
}
