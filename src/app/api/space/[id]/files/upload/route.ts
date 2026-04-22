import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { upsertSpaceFileBinary, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let form: FormData;
    try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

    const file = form.get('file') as File | null;
    const customPath = form.get('path') as string | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const b64 = buffer.toString('base64');
    const path = customPath || `images/${file.name}`;

    await upsertSpaceFileBinary(id, path, b64, file.type || 'application/octet-stream');
    return NextResponse.json({ ok: true, path }, { status: 201 });
}
