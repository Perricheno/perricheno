import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { restoreSpaceVersion, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; vid: string }> };

export async function POST(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, vid } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await restoreSpaceVersion(vid, id, userId);
    return NextResponse.json({ ok: true });
}
