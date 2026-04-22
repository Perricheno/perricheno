import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { duplicateSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const space = await duplicateSpace(id, userId);
    if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ space }, { status: 201 });
}
