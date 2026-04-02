import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getAgentSession, updateAgentSession, deleteAgentSession } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { id } = await context.params;
    const session = getAgentSession(id);

    if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ 
        session: {
            id: session.id,
            status: session.status,
            stream_text: session.stream_text,
            error_msg: session.error_msg,
            main_tex: session.main_tex,
            references_bib: session.references_bib,
            visuals_json: session.visuals_json,
            settings_json: session.settings_json,
            doc_type: session.doc_type,
            title: session.title,
            updated_at: session.updated_at
        } 
    });
}

// PUT /api/agent/sessions/[id] — update session fields (visuals_json, main_tex, etc.)
export async function PUT(req: Request, context: RouteContext) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { id } = await context.params;
    const session = getAgentSession(id);

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.user_id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    try {
        const body = await req.json();
        const update: Record<string, any> = {};

        // Only allow specific fields to be updated
        if (body.main_tex !== undefined) update.main_tex = body.main_tex;
        if (body.references_bib !== undefined) update.references_bib = body.references_bib;
        if (body.settings_json !== undefined) update.settings_json = typeof body.settings_json === 'string' ? body.settings_json : JSON.stringify(body.settings_json);
        if (body.title !== undefined) update.title = body.title;

        // visuals_json: accept array or string
        if (body.visuals_json !== undefined) {
            update.visuals_json = typeof body.visuals_json === 'string' 
                ? body.visuals_json 
                : JSON.stringify(body.visuals_json);
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        updateAgentSession(id, update);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("PUT session error:", e);
        return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
    }
}

// DELETE /api/agent/sessions/[id]
export async function DELETE(req: Request, context: RouteContext) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { id } = await context.params;
    const deleted = deleteAgentSession(id, userId);

    if (!deleted) return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 });
    return NextResponse.json({ success: true });
}
