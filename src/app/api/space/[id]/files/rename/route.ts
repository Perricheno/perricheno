import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { renameSpaceFile, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const from = String(body.from || '').trim();
    const to   = String(body.to   || '').trim();
    if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 });
    if (from === to)  return NextResponse.json({ ok: true });

    await renameSpaceFile(id, from, to);
    return NextResponse.json({ ok: true });
}
