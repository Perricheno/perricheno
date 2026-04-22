import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { createSpace, getSpacesByUser } from '@/lib/space-db';
import type { Compiler } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const spaces = await getSpacesByUser(userId);
    return NextResponse.json({ spaces });
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const title = String(body.title || 'Untitled Project').slice(0, 120);
    const template = body.template || 'blank';
    const compiler: Compiler = ['pdflatex', 'xelatex', 'lualatex'].includes(body.compiler) ? body.compiler : 'pdflatex';

    const space = await createSpace(userId, title, template, compiler);
    return NextResponse.json({ space }, { status: 201 });
}
