import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpaceFiles, upsertSpaceFile, deleteSpaceFile, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/space/[id]/files — list all files (paths + metadata, no content)
export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const files = await getSpaceFiles(id);
    // Strip heavy content for listing — clients fetch individual file content separately
    const listing = files.map(f => ({
        id: f.id,
        path: f.path,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
        updated_at: f.updated_at,
        is_binary: f.is_binary,
    }));
    return NextResponse.json({ files: listing });
}

// POST /api/space/[id]/files — create a new text file
export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const path = String(body.path || '').trim();
    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

    const content = String(body.content ?? '');
    await upsertSpaceFile(id, path, content);
    return NextResponse.json({ ok: true }, { status: 201 });
}
