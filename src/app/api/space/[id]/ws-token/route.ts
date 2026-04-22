import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifySession } from '@/lib/session';
import { getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const secret = new TextEncoder().encode(
        process.env.WS_JWT_SECRET || 'fallback-secret-key-at-least-thirty-two-chars-long'
    );

    const token = await new SignJWT({ spaceId: id, userId, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret);

    return NextResponse.json({ token });
}
