import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { enableSpaceSharing, disableSpaceSharing, getSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.enabled === false) {
        await disableSpaceSharing(id, userId);
        return NextResponse.json({ ok: true, enabled: false });
    }

    const shareId = await enableSpaceSharing(id, userId);
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://perricheno.ru'}/space/pub/${shareId}`;
    return NextResponse.json({ ok: true, enabled: true, shareId, url });
}
