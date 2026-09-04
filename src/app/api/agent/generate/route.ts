import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import {
    createAgentSession, updateAgentSession,
    checkAndDeductUsage, getActiveAgentSessionsCount,
    sendTelegramNotification,
} from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getQueue } from '@/lib/queue';
import type { PipelineSettings, DocType } from '@/lib/agent/pipeline/types';

export const dynamic = 'force-dynamic';

// ── Request handler ──
// Generation itself runs in the standalone worker process (src/worker/index.ts,
// src/lib/jobs/reportGenerate.ts) so it survives a web-container restart, not
// just a client disconnect. This route only validates, persists the initial
// AgentSession row, and enqueues the job.

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
        visualCount: typeof body.visualCount === "number"
            ? Math.max(0, Math.min(10, Math.round(body.visualCount)))
            : undefined,
        dataUploadIds: Array.isArray(body.dataUploadIds) ? body.dataUploadIds : undefined,
        dataRuntime: body.dataRuntime === "Python" ? "Python" : "R",
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

    // Enqueue the job. The client will poll /api/agent/sessions/[id] for stage_json.
    await getQueue().add('report-generate', { sessionId, userId, settings });

    return NextResponse.json({ sessionId });
}

// ── Legacy thin path: edits and error-fix on an existing session. ──

async function handleLegacyEdit(userId: number, body: any): Promise<Response> {
    if (!body.currentTex) {
        return NextResponse.json({ error: 'Legacy path requires currentTex.' }, { status: 400 });
    }

    const sessionId = body.sessionId;
    if (!sessionId) return NextResponse.json({ error: 'sessionId required for edit' }, { status: 400 });

    // Clear stage_json so the client doesn't show stale generation stages during the edit
    await updateAgentSession(sessionId, { status: 'generating', error_msg: null, stream_text: null, stage_json: null });

    await getQueue().add('report-edit', {
        sessionId,
        userId,
        language: body.language,
        prompt: body.prompt,
        currentTex: body.currentTex,
        currentBib: body.currentBib,
        errorLog: body.errorLog,
    });

    return NextResponse.json({ sessionId });
}
