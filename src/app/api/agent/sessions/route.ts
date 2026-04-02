import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { createAgentSession, getAgentSessionsByUser } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET /api/agent/sessions — list user's sessions
export async function GET() {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const sessions = getAgentSessionsByUser(userId);
    return NextResponse.json({ sessions });
}

// POST /api/agent/sessions — create new session
export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const body = await req.json();
    const { title, doc_type, settings_json, main_tex, references_bib, visuals_json } = body;

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const session = createAgentSession({
        id: uuidv4(),
        user_id: userId,
        title,
        doc_type: doc_type || 'research',
        settings_json: settings_json ? JSON.stringify(settings_json) : undefined,
        main_tex,
        references_bib,
        visuals_json: visuals_json ? JSON.stringify(visuals_json) : undefined,
    });

    return NextResponse.json({ session }, { status: 201 });
}
