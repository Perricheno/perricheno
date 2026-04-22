import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getCitation, updateCitation, deleteCitation } from '@/lib/citations-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const citation = await getCitation(userId, id);
    if (!citation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ citation });
}

export async function PATCH(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const patch = await req.json();
    const allowed = ['title', 'authors', 'year', 'venue', 'abstract', 'url',
                     'bibtex', 'cite_key', 'tags', 'notes', 'starred',
                     'doi', 'arxiv_id', 'isbn'];
    const clean: Record<string, unknown> = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];

    const updated = await updateCitation(userId, id, clean);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ citation: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const ok = await deleteCitation(userId, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
