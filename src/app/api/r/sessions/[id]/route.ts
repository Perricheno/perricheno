import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getRSession, deleteRSession } from '@/lib/r-db';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { id } = await params;
    const session = await getRSession(id, userId);
    if (!session) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    let results = [];
    if (session.results_json) {
        try { results = JSON.parse(session.results_json); } catch { /* ignore */ }
    }

    return NextResponse.json({
        session: {
            id: session.id,
            title: session.title,
            prompt: session.prompt,
            status: session.status,
            results,
            created_at: session.created_at,
            updated_at: session.updated_at,
        },
    });
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { id } = await params;
    const ok = await deleteRSession(id, userId);
    if (!ok) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    return NextResponse.json({ success: true });
}
