import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getAgentSession, updateAgentSession, deleteAgentSession, toggleAgentSessionShare } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/agent/sessions/[id]
export async function GET(req: Request, { params }: RouteParams) {
    const { id } = await params;
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const session = getAgentSession(id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ session });
}

// PUT /api/agent/sessions/[id]
export async function PUT(req: Request, { params }: RouteParams) {
    const { id } = await params;
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const session = getAgentSession(id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    updateAgentSession(id, {
        title: body.title,
        main_tex: body.main_tex,
        references_bib: body.references_bib,
        r_images_json: body.r_images_json ? JSON.stringify(body.r_images_json) : undefined,
        settings_json: body.settings_json ? JSON.stringify(body.settings_json) : undefined,
    });

    return NextResponse.json({ success: true });
}

// DELETE /api/agent/sessions/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
    const { id } = await params;
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const deleted = deleteAgentSession(id, userId);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true });
}
