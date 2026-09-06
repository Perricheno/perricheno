import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import {
    createAgentSession, checkAndDeductUsage, getActiveAgentSessionsCount,
} from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getQueue } from '@/lib/queue';
import type { DocToTexSettings, DocToTexMode } from '@/lib/agent/docToTex/types';

export const dynamic = 'force-dynamic';

// Conversion runs in the standalone worker process (same reasoning as
// /api/agent/generate): this route only validates, persists the initial
// AgentSession row (doc_type: 'doc_to_tex'), and enqueues the job. The client
// polls the existing generic /api/agent/sessions/[id] route for progress -
// it already returns everything needed (stage_json, main_tex, status) for
// any doc_type, so Doc-to-TeX doesn't need its own polling endpoint.

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

    const uploadIds: string[] = Array.isArray(body.uploadIds) ? body.uploadIds.slice(0, 1) : [];
    if (uploadIds.length === 0) {
        return NextResponse.json({ error: 'uploadIds is required (exactly one document).' }, { status: 400 });
    }

    const settings: DocToTexSettings = {
        uploadIds,
        mode: (body.mode === 'rewrite' ? 'rewrite' : 'faithful') as DocToTexMode,
        templateId: typeof body.templateId === 'string' ? body.templateId : 'plain',
        customTemplatePreamble: typeof body.customTemplatePreamble === 'string' && body.customTemplatePreamble
            ? body.customTemplatePreamble
            : undefined,
        // Auto-detected from the source text in runDocToTexPipeline - faithful
        // mode never translates, so this placeholder is always overridden.
        language: 'en',
        authorName: body.authorName,
        courseName: body.courseName,
        dateStr: body.dateStr,
        groupName: body.groupName,
        supervisorName: body.supervisorName,
    };

    const sessionId = uuidv4();
    const shareId = uuidv4().split('-')[0];
    const title = (body.title ? String(body.title) : 'Doc to TeX').slice(0, 80);

    await createAgentSession({
        id: sessionId,
        user_id: userId,
        title,
        doc_type: 'doc_to_tex',
        status: 'generating',
        stream_text: null,
        share_id: shareId,
        settings_json: JSON.stringify(settings),
    });

    await getQueue().add('doc-to-tex-convert', { sessionId, userId, settings });

    return NextResponse.json({ sessionId });
}
