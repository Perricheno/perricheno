import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * Handle persistent chat history and session management
 */

// GET /api/chat/history?sessionId=... - Get messages for a session
// GET /api/chat/history - Get all sessions for user
export async function GET(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const sessionId = req.nextUrl.searchParams.get("sessionId");

    try {
        if (sessionId) {
            const { data: messages } = await supabase.from('chat_messages')
                .select('id, role, content, created_at')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            return NextResponse.json({ 
                messages: (messages || []).map(m => ({
                    id: m.id,
                    role: m.role,
                    text: m.content,
                    timestamp: new Date(m.created_at)
                }))
            });
        } else {
            const { data: sessions } = await supabase.from('chat_sessions')
                .select('id, title, created_at')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            return NextResponse.json({ sessions: (sessions || []).map(s => ({ ...s, createdAt: s.created_at })) });
        }
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

// POST /api/chat/history - Create/Update session or message
export async function POST(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const body = await req.json();
        const { action, sessionId, title, message } = body;

        if (action === "create_session") {
            await supabase.from('chat_sessions').insert({ id: sessionId, user_id: userId, title });
            return NextResponse.json({ success: true });
        }

        if (action === "save_message") {
            const { id, role, text, metadata } = message;
            
            const { data: session } = await supabase.from('chat_sessions').select('id').eq('id', sessionId).maybeSingle();
            if (!session) {
                await supabase.from('chat_sessions').insert({ id: sessionId, user_id: userId, title: title || "New Chat" });
            }

            await supabase.from('chat_messages').insert({
                id, session_id: sessionId, role, content: text, metadata_json: JSON.stringify(metadata || {})
            });

            await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err) {
        console.error("[Chat History API] Error:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    try {
        await supabase.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
