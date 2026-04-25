import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpaceFile, upsertSpaceFile, deleteSpaceFile, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2 MB

type Ctx = { params: Promise<{ id: string; path: string[] }> };

function joinPath(segments: string[]) { return segments.join('/'); }

function isValidPath(p: string) {
    return p.length > 0 && !p.startsWith('/') && !p.includes('../') && !p.includes('\0');
}

// GET - file content
export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, path } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const file = await getSpaceFile(id, joinPath(path));
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    return NextResponse.json({ file });
}

// PUT - create or update file content
export async function PUT(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, path } = await params;

    const filePath = joinPath(path);
    if (!isValidPath(filePath)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const content = String(body.content ?? '');
    if (new TextEncoder().encode(content).length > MAX_TEXT_BYTES) {
        return NextResponse.json({ error: 'File too large (max 2 MB)' }, { status: 413 });
    }

    await upsertSpaceFile(id, filePath, content, body.mime_type);
    return NextResponse.json({ ok: true });
}

// DELETE - remove file
export async function DELETE(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, path } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await deleteSpaceFile(id, joinPath(path));
    return NextResponse.json({ ok: true });
}
