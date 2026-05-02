import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getRSessionsByUser } from '@/lib/r-db';

export async function GET() {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const sessions = await getRSessionsByUser(userId);
    return NextResponse.json({ sessions });
}
