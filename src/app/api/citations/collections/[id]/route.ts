import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { deleteCollection, addCitationToCollection, removeCitationFromCollection } from '@/lib/citations-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const ok = await deleteCollection(userId, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}

// Add or remove a citation from a collection:
//   POST   { citationId: "..." }   → link
//   DELETE-with-body same shape is cumbersome; use PATCH with { remove: true }
export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { citationId, remove } = await req.json();
    if (!citationId) return NextResponse.json({ error: 'citationId required' }, { status: 400 });

    try {
        if (remove) await removeCitationFromCollection(userId, id, citationId);
        else        await addCitationToCollection(userId, id, citationId);
    } catch (e: any) {
        return NextResponse.json({ error: e.message ?? 'Failed' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
}
