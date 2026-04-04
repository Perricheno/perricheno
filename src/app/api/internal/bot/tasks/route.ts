import { NextRequest, NextResponse } from "next/server";
import db, { getUserByTelegramId } from "@/lib/db";

export async function POST(req: NextRequest) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const authHeader = req.headers.get("X-Bot-Secret");

    if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { telegram_id, action, sessionId } = await req.json();
        const user = getUserByTelegramId(String(telegram_id));
        
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 1. Handle Task Reset/Cleanup
        if (action === "reset" && sessionId) {
            db.prepare(`UPDATE agent_sessions SET status = 'failed', error_msg = 'Manual reset via bot' WHERE id = ? AND user_id = ?`).run(sessionId, user.id);
            return NextResponse.json({ success: true, message: "Task reset complete." });
        }

        // 2. Query Active Tasks
        const tasks = db.prepare(`
            SELECT id, title, status, created_at 
            FROM agent_sessions 
            WHERE user_id = ? AND status IN ('generating', 'processing', 'extracting')
            ORDER BY created_at DESC
        `).all(user.id) as any[];

        return NextResponse.json({ 
            success: true, 
            tasks: tasks.map(t => ({
                ...t,
                timeAgo: Math.floor((Date.now() - new Date(t.created_at).getTime()) / 1000 / 60) // minutes ago
            })) 
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
