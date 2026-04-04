import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import db from "@/lib/db";

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
            // Get messages for one session
            const messages = db.prepare(`
                SELECT id, role, content as text, created_at as timestamp 
                FROM chat_messages 
                WHERE session_id = ? 
                ORDER BY created_at ASC
            `).all(sessionId) as any[];

            return NextResponse.json({ 
                messages: messages.map(m => ({
                    ...m,
                    timestamp: new Date(m.timestamp + 'Z')
                }))
            });
        } else {
            // Get all sessions for user
            const sessions = db.prepare(`
                SELECT id, title, created_at as createdAt 
                FROM chat_sessions 
                WHERE user_id = ? 
                ORDER BY updated_at DESC
            `).all(userId) as any[];

            return NextResponse.json({ sessions });
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
            db.prepare(`
                INSERT INTO chat_sessions (id, user_id, title)
                VALUES (?, ?, ?)
            `).run(sessionId, userId, title);
            return NextResponse.json({ success: true });
        }

        if (action === "save_message") {
            const { id, role, text, metadata } = message;
            
            // Ensure session exists (auto-create if missing for robustness)
            const session = db.prepare("SELECT id FROM chat_sessions WHERE id = ?").get(sessionId);
            if (!session) {
                db.prepare(`INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)`).run(sessionId, userId, title || "New Chat");
            }

            db.prepare(`
                INSERT INTO chat_messages (id, session_id, role, content, metadata_json)
                VALUES (?, ?, ?, ?, ?)
            `).run(id, sessionId, role, text, JSON.stringify(metadata || {}));

            // Update session timestamp
            db.prepare(`UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

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
        db.prepare("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?").run(sessionId, userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
