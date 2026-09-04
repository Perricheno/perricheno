// Job processors for the main LaTeX report pipeline (report-generate,
// report-edit). Extracted from src/app/api/agent/generate/route.ts (Phase 6a)
// so they can run inside the standalone worker process (src/worker/index.ts)
// instead of an unawaited in-process promise - a redeploy/restart of the web
// container no longer kills an in-flight generation.

import {
    createAgentSession, updateAgentSession, getAgentSession,
    checkAndDeductUsage, getUserById, getAgentUploadsByIds,
    updateTelegramNotification,
} from '@/lib/db';
import { runPipeline } from '@/lib/agent/pipeline';
import type { PipelineSettings } from '@/lib/agent/pipeline/types';

export interface ReportGenerateJobData {
    sessionId: string;
    userId: number;
    settings: PipelineSettings;
}

export async function runReportGenerate({ sessionId, userId, settings }: ReportGenerateJobData): Promise<void> {
    // Idempotency guard: BullMQ redelivers a job if the worker crashes mid-run
    // (stalled-job recovery). If a previous attempt already finished (status
    // moved off 'generating'), skip re-running to avoid double billing/notifying.
    // NOTE: this does not close the narrow window where a crash happens after
    // billing but before the final status write below - a known, accepted gap,
    // not solved here (would need per-attempt idempotency keys in billing).
    const existing = await getAgentSession(sessionId);
    if (!existing || existing.status !== 'generating') {
        console.log(`[report-generate] session ${sessionId} already left 'generating' (${existing?.status}) - skipping duplicate delivery`);
        return;
    }

    try {
        const allUploadIds = [
            ...(settings.uploadIds ?? []),
            ...(settings.dataUploadIds ?? []),
        ];
        const uploads = allUploadIds.length > 0
            ? await getAgentUploadsByIds(allUploadIds, userId)
            : [];

        // Normalize images_json to arrays (Supabase may hand back jsonb as object or string).
        for (const u of uploads) {
            if (typeof u.images_json === 'string') {
                try { (u as any).images_json = JSON.parse(u.images_json); } catch { (u as any).images_json = []; }
            } else if (!u.images_json) {
                (u as any).images_json = [];
            }
        }

        const writeProgress = async (progress: any) => {
            await updateAgentSession(sessionId, { stage_json: progress });
        };

        const result = await runPipeline({ settings, uploads, writeProgress });

        // Final persist.
        await updateAgentSession(sessionId, {
            status: result.status,
            main_tex: result.mainTex,
            references_bib: result.referencesBib,
            stream_text: null,
            error_msg: result.compiled ? null : (result.errorLog?.slice(0, 500) ?? 'Compilation unresolved after retries'),
        });

        // Token-accurate billing across all stages.
        if (result.totalTokens > 0) {
            // Convert model-reported tokens to characters for the existing quota
            // system. 1 token ≈ 4 chars of English, ≈ 2.2 for Russian. We use 3.
            const charEquivalent = result.totalTokens * 3;
            await checkAndDeductUsage(userId, 'chars', charEquivalent);
        }

        // Telegram notification.
        const session = await getAgentSession(sessionId);
        if (session?.tg_message_id) {
            const user = await getUserById(userId);
            const remaining = user ? (user.purchased_chars + 15000 - user.daily_chars_used) : 0;
            const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://perricheno.ru'}/agent/shared/${session.share_id}`;
            const label = result.compiled ? '✅ *Генерация завершена*' : '⚠️ *Готово, требует внимания*';
            const detail = result.compiled
                ? `• Разделов: ${result.sections.length}\n• Слов: ~${result.sections.reduce((a, s) => a + s.wordCount, 0)}\n• Токенов: ${result.totalTokens.toLocaleString()}`
                : `Документ собран, но LaTeX не скомпилировался с первых попыток. Вы можете открыть его и исправить вручную.`;
            await updateTelegramNotification(userId, session.tg_message_id,
                `${label}: ${session.title}\n\n📊 *Статистика*:\n${detail}\n• Остаток: ${remaining} символов\n\n🔗 [Открыть](${pdfUrl})`
            );
        }
    } catch (err: any) {
        console.error('[report-generate] job error:', err);
        await updateAgentSession(sessionId, {
            status: 'error',
            error_msg: String(err?.message || err).slice(0, 500),
            stream_text: null,
        });
        const session = await getAgentSession(sessionId);
        if (session?.tg_message_id) {
            await updateTelegramNotification(userId, session.tg_message_id,
                `❌ *Ошибка генерации*: ${session.title}\n\n${String(err?.message || err).slice(0, 200)}`
            );
        }
    }
}

export interface ReportEditJobData {
    sessionId: string;
    userId: number;
    language?: string;
    prompt?: string;
    currentTex?: string;
    currentBib?: string;
    errorLog?: string;
}

export async function runReportEdit(data: ReportEditJobData): Promise<void> {
    const { sessionId, userId, language, prompt, currentTex, currentBib, errorLog } = data;

    const existing = await getAgentSession(sessionId);
    if (!existing || existing.status !== 'generating') {
        console.log(`[report-edit] session ${sessionId} already left 'generating' (${existing?.status}) - skipping duplicate delivery`);
        return;
    }

    const { chatCompletion, parseJsonLoose } = await import('@/lib/agent/pipeline/llm');

    const lang = language === 'ru' ? 'Russian' : 'English';
    const sys = `You are a LaTeX editor. Return ONLY JSON: {"main_tex": "...", "references_bib": "..."}. No fences, no commentary. Language: ${lang}.`;

    let userMsg: string;
    if (errorLog && currentTex) {
        const extraGuidance = prompt?.trim() ? `\n\nADDITIONAL GUIDANCE FROM USER:\n${prompt}` : '';
        userMsg = `Fix ALL compilation errors and return full corrected files. Preserve prose and structure - minimal surgical edits only.${extraGuidance}\n\nERROR LOG:\n${errorLog}\n\nCURRENT main.tex:\n${currentTex}\n\n${currentBib ? `CURRENT references.bib:\n${currentBib}` : ''}`;
    } else if (currentTex) {
        userMsg = `Apply these changes to the document and return full updated files.\n\nCHANGE REQUEST:\n${prompt || '(none)'}\n\nCURRENT main.tex:\n${currentTex}\n\n${currentBib ? `CURRENT references.bib:\n${currentBib}` : ''}`;
    } else {
        await updateAgentSession(sessionId, { status: 'error', error_msg: 'Legacy path requires currentTex.' });
        return;
    }

    try {
        const r = await chatCompletion(
            [
                { role: 'system', content: sys },
                { role: 'user', content: userMsg },
            ],
            { jsonMode: true, timeoutMs: 180_000 },
        );

        const parsed: any = parseJsonLoose(r.text);
        const { normalizeLatexText, ensureRussianPreamble } = await import('@/lib/agent/stages');
        const mainTex = ensureRussianPreamble(normalizeLatexText(parsed.main_tex || ''), language === 'ru' ? 'ru' : 'en');
        const refs = typeof parsed.references_bib === 'string' && parsed.references_bib.trim()
            ? normalizeLatexText(parsed.references_bib)
            : null;

        await updateAgentSession(sessionId, {
            status: 'done',
            main_tex: mainTex,
            references_bib: refs,
            stream_text: null,
            error_msg: null,
        });

        if (r.totalTokens > 0) await checkAndDeductUsage(userId, 'chars', r.totalTokens * 3);
    } catch (e: any) {
        await updateAgentSession(sessionId, {
            status: 'error',
            error_msg: String(e?.message || e).slice(0, 500),
        });
    }
}
