import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpace, updateSpace, deleteSpace, duplicateSpace, getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const space = await getSpace(id, userId);
    if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ space });
}

export async function PATCH(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (role !== 'owner') return NextResponse.json({ error: 'Only owner can edit settings' }, { status: 403 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    await updateSpace(id, userId, {
        title: body.title,
        description: body.description,
        compiler: body.compiler,
        main_file: body.main_file,
        auto_compile: body.auto_compile,
        is_public: body.is_public,
    });
    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await deleteSpace(id, userId);
    return NextResponse.json({ ok: true });
}
