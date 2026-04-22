import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpaceInviteByToken, acceptSpaceInvite } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };

// GET — preview the invite (show role before accepting, do not expose email)
export async function GET(_req: Request, { params }: Ctx) {
    const { token } = await params;
    const invite = await getSpaceInviteByToken(token);
    if (!invite) return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    return NextResponse.json({ invite: { space_id: invite.space_id, role: invite.role } });
}

// POST — accept the invite
export async function POST(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token } = await params;
    const result = await acceptSpaceInvite(token, userId);
    if (!result) return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });

    return NextResponse.json({ ok: true, spaceId: result.spaceId });
}
