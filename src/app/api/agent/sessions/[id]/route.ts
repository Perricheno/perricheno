import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getAgentSession } from '@/lib/db';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
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

    // Only return the fields we need for polling to keep the payload light
    return NextResponse.json({ 
        session: {
            id: session.id,
            status: session.status,
            stream_text: session.stream_text,
            error_msg: session.error_msg,
            main_tex: session.main_tex,
            references_bib: session.references_bib,
            r_images_json: session.r_images_json,
            settings_json: session.settings_json,
            doc_type: session.doc_type,
            title: session.title,
            updated_at: session.updated_at
        } 
    });
}
