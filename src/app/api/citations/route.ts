import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { listCitations, createCitation, type NewCitation } from '@/lib/citations-db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const search        = url.searchParams.get('search')       ?? undefined;
    const tag           = url.searchParams.get('tag')          ?? undefined;
    const starred       = url.searchParams.get('starred') === '1';
    const collectionId  = url.searchParams.get('collection')   ?? null;

    const citations = await listCitations(userId, { search, tag, starred, collectionId });
    return NextResponse.json({ citations });
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Partial<NewCitation>;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    if (!body.title || !body.bibtex || !body.cite_key) {
        return NextResponse.json({ error: 'title, bibtex, cite_key are required' }, { status: 400 });
    }

    const citation = await createCitation(userId, {
        doi:      body.doi      ?? null,
        arxiv_id: body.arxiv_id ?? null,
        isbn:     body.isbn     ?? null,
        title:    body.title,
        authors:  body.authors  ?? [],
        year:     body.year     ?? null,
        venue:    body.venue    ?? null,
        abstract: body.abstract ?? null,
        url:      body.url      ?? null,
        bibtex:   body.bibtex,
        cite_key: body.cite_key,
        tags:     body.tags     ?? [],
        notes:    body.notes    ?? null,
        starred:  body.starred  ?? false,
    });

    return NextResponse.json({ citation });
}
