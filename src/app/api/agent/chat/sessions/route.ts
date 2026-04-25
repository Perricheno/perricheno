import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { createAgentSession, getAgentSessionsByUser } from '@/lib/db';

// POST - create new chat session
// GET  - list chat sessions
export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { initialMessage } = await req.json().catch(() => ({}));

    const title = initialMessage ? initialMessage.slice(0, 80) : 'New Chat';
    const id = crypto.randomUUID();
    
    try {
        const session = await createAgentSession({
            id,
            user_id: userId,
            title,
            doc_type: 'chat',
            status: 'done',
            stream_text: '[]',
            main_tex: null,
            references_bib: null,
            visuals_json: null,
            settings_json: null,
        });

        return NextResponse.json({ sessionId: session?.id || id });
    } catch (err: any) {
        console.error('Failed to create chat session:', err);
        return NextResponse.json({ error: err.message || "Failed to create session" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const sessions = await getAgentSessionsByUser(userId);
    const chatSessions = sessions.filter(s => s.doc_type === 'chat');
    
    return NextResponse.json({ sessions: chatSessions });
}
