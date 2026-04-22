import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { removeCollaborator, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; uid: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, uid } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const targetUid = parseInt(uid, 10);
    // Owner can remove anyone; editors can only remove themselves
    if (role !== 'owner' && userId !== targetUid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await removeCollaborator(id, targetUid);
    return NextResponse.json({ ok: true });
}
