import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { listCollections, createCollection } from '@/lib/citations-db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const collections = await listCollections(userId);
    return NextResponse.json({ collections });
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name, color } = await req.json();
    if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const collection = await createCollection(userId, name.trim(), color);
    return NextResponse.json({ collection });
}
