import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpaceVersions, createSpaceVersion, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const versions = await getSpaceVersions(id);
    return NextResponse.json({ versions });
}

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any = {};
    try { body = await req.json(); } catch {}

    const label = String(body.label || 'Manual save').slice(0, 100);
    const message = body.message ? String(body.message).slice(0, 500) : undefined;
    const version = await createSpaceVersion(id, userId, label, message);
    return NextResponse.json({ version }, { status: 201 });
}
