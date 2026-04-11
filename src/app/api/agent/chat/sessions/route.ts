import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { createAgentSession, getAgentSessionsByUser } from '@/lib/db';

// POST — create new chat session
// GET  — list chat sessions
export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { initialMessage } = await req.json().catch(() => ({}));

    const title = initialMessage ? initialMessage.slice(0, 80) : 'New Chat';
    
    const session = await createAgentSession({
        user_id: userId,
        title,
        doc_type: 'chat',
        status: 'done',
        stream_text: '[]', // empty messages array
        main_tex: null,
        references_bib: null,
        visuals_json: null,
        settings_json: null,
    });

    return NextResponse.json({ sessionId: session.id });
}

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const sessions = await getAgentSessionsByUser(userId);
    const chatSessions = sessions.filter(s => s.doc_type === 'chat');
    
    return NextResponse.json({ sessions: chatSessions });
}
