import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import {
    createAgentSession, updateAgentSession, getAgentSession,
    checkAndDeductUsage, getActiveAgentSessionsCount,
    sendTelegramNotification, updateTelegramNotification,
    getUserById, getAgentUploadsByIds,
} from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { runPipeline } from '@/lib/agent/pipeline';
import type { PipelineSettings, DocType } from '@/lib/agent/pipeline/types';

export const maxDuration = 600; // orchestrator may run for several minutes
export const dynamic = 'force-dynamic';

// ── Background orchestration ──
// Persists progress to agent_sessions.stage_json so the UI can poll it.

async function runBackground(
    sessionId: string,
    userId: number,
    settings: PipelineSettings,
) {
    try {
        const uploads = settings.uploadIds && settings.uploadIds.length > 0
            ? await getAgentUploadsByIds(settings.uploadIds, userId)
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
        console.error('[generate] background error:', err);
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

// ── Request handler ──

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API Key is not configured.' }, { status: 500 });
    }

    const precheck = await checkAndDeductUsage(userId, 'chars', 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: 'LIMIT_REACHED', details: 'Characters limit reached.' }, { status: 402 });
    }

    const activeCount = await getActiveAgentSessionsCount(userId);
    if (activeCount >= 3) {
        return NextResponse.json({
            error: 'Достигнут лимит одновременных генераций (макс. 3). Дождитесь завершения текущих задач.',
        }, { status: 429 });
    }

    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    // ── Regeneration / edit / error-fix paths take the legacy single-call shape. ──
    // These are small, targeted operations (the user edited a section or fed back
    // a compile error) - running the full 5-stage pipeline would be overkill.
    // We fall back to a tiny direct call.
    if (body.currentTex || body.errorLog) {
        return handleLegacyEdit(userId, body);
    }

    // ── New pipeline path. ──
    const settings: PipelineSettings = {
        prompt: String(body.prompt || '').trim(),
        docType: (body.type || 'research') as DocType,
        style: body.style || 'medium',
        wordCount: Math.max(300, Math.min(30_000, Number(body.wordCount) || 2000)),
        columns: body.columns === 1 ? 1 : 2,
        useTemplate: body.useTemplate ?? true,
        templateId: typeof body.templateId === "string" ? body.templateId : undefined,
        customTemplatePreamble: typeof body.customTemplatePreamble === "string" && body.customTemplatePreamble
            ? body.customTemplatePreamble
            : undefined,
        useReferences: body.useReferences ?? false,
        language: typeof body.language === 'string' && body.language ? body.language.slice(0, 10).toLowerCase() : 'en',
        authorName: body.authorName,
        courseName: body.courseName,
        dateStr: body.dateStr,
        groupName: body.groupName,
        supervisorName: body.supervisorName,
        taskDescription: body.taskDescription,
        taskFileText: body.taskFileText,
        referenceLinks: Array.isArray(body.referenceLinks) ? body.referenceLinks : undefined,
        uploadIds: Array.isArray(body.uploadIds) ? body.uploadIds : undefined,
    };

    if (!settings.prompt) return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });

    const sessionId = uuidv4();
    const shortTitle = settings.prompt.slice(0, 50).trim();
    const shareId = uuidv4().split('-')[0];

    const tgMsgId = await sendTelegramNotification(
        userId,
        `🚀 *Начало генерации*: ${shortTitle}\n\nПайплайн из 5 стадий. Это может занять несколько минут.`,
    );

    await createAgentSession({
        id: sessionId,
        user_id: userId,
        title: shortTitle + (settings.prompt.length > 50 ? '…' : ''),
        doc_type: settings.docType,
        status: 'generating',
        stream_text: null,
        share_id: shareId,
        tg_message_id: tgMsgId || undefined,
        settings_json: JSON.stringify(settings),
    });

    // Fire and forget. The client will poll /api/agent/sessions/[id] for stage_json.
    runBackground(sessionId, userId, settings).catch(e => console.error('[generate] bg crash:', e));

    return NextResponse.json({ sessionId });
}

// ── Legacy thin path: edits and error-fix on an existing session. ──

async function handleLegacyEdit(userId: number, body: any): Promise<Response> {
    const { chatCompletion, parseJsonLoose } = await import('@/lib/agent/pipeline/llm');

    const lang = body.language === 'ru' ? 'Russian' : 'English';
    const sys = `You are a LaTeX editor. Return ONLY JSON: {"main_tex": "...", "references_bib": "..."}. No fences, no commentary. Language: ${lang}.`;

    let userMsg: string;
    if (body.errorLog && body.currentTex) {
        const extraGuidance = body.prompt?.trim() ? `\n\nADDITIONAL GUIDANCE FROM USER:\n${body.prompt}` : '';
        userMsg = `Fix ALL compilation errors and return full corrected files. Preserve prose and structure - minimal surgical edits only.${extraGuidance}\n\nERROR LOG:\n${body.errorLog}\n\nCURRENT main.tex:\n${body.currentTex}\n\n${body.currentBib ? `CURRENT references.bib:\n${body.currentBib}` : ''}`;
    } else if (body.currentTex) {
        userMsg = `Apply these changes to the document and return full updated files.\n\nCHANGE REQUEST:\n${body.prompt || '(none)'}\n\nCURRENT main.tex:\n${body.currentTex}\n\n${body.currentBib ? `CURRENT references.bib:\n${body.currentBib}` : ''}`;
    } else {
        return NextResponse.json({ error: 'Legacy path requires currentTex.' }, { status: 400 });
    }

    const sessionId = body.sessionId;
    if (!sessionId) return NextResponse.json({ error: 'sessionId required for edit' }, { status: 400 });

    // Clear stage_json so the client doesn't show stale generation stages during the edit
    await updateAgentSession(sessionId, { status: 'generating', error_msg: null, stream_text: null, stage_json: null });

    (async () => {
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
            const mainTex = ensureRussianPreamble(normalizeLatexText(parsed.main_tex || ''), body.language === 'ru' ? 'ru' : 'en');
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
    })().catch(e => console.error('[generate-legacy] bg:', e));

    return NextResponse.json({ sessionId });
}
