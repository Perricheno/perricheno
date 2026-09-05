import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getAgentSession } from '@/lib/db';
import { downloadFromStorage } from '@/lib/storage';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(req: Request, context: RouteContext) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const { sessionId } = await context.params;
    const session = await getAgentSession(sessionId);
    if (!session || session.user_id !== userId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let stage: any = {};
    try { stage = session.stage_json ? JSON.parse(session.stage_json as unknown as string) : {}; } catch { stage = {}; }
    const path = stage.pdf_storage_path;
    if (!path) return NextResponse.json({ error: 'No compiled PDF for this session' }, { status: 404 });

    try {
        const buf = await downloadFromStorage(path);
        return new Response(buf, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${(session.title || 'document').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf"`,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed to fetch stored PDF', details: String(e?.message || e).slice(0, 200) }, { status: 500 });
    }
}
