import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifySession } from '@/lib/session';
import { getUserRoleInSpace } from '@/lib/space-db';
import { WS_JWT_SECRET } from '@/lib/config';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!WS_JWT_SECRET) {
        console.error('[ws-token] WS_JWT_SECRET is not set - refusing to issue a predictable token');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    const secret = new TextEncoder().encode(WS_JWT_SECRET);

    const token = await new SignJWT({ spaceId: id, userId, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret);

    return NextResponse.json({ token });
}
