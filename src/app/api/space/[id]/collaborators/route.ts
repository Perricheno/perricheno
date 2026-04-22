import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpaceCollaborators, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const collaborators = await getSpaceCollaborators(id);
    return NextResponse.json({ collaborators });
}
