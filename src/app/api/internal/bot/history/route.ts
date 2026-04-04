import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { telegram_id, sessionId, page = 1, limit = 5 } = await req.json();

        // Single Session View
        if (sessionId) {
            const session = db.prepare(`
                SELECT id, title, status, share_id, created_at, updated_at 
                FROM agent_sessions 
                WHERE id = ?
            `).get(sessionId) as any;
            return NextResponse.json({ session });
        }

        if (!telegram_id) return NextResponse.json({ error: "Missing telegram_id" }, { status: 400 });

        const user = db.prepare("SELECT id FROM users WHERE telegram_id = ?").get(telegram_id) as any;
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const offset = (page - 1) * limit;

        // Get sessions for agent reports
        const stats = db.prepare("SELECT COUNT(*) as total FROM agent_sessions WHERE user_id = ?").get(user.id) as { total: number };
        const sessions = db.prepare(`
            SELECT id, title, status, created_at, updated_at 
            FROM agent_sessions 
            WHERE user_id = ? 
            ORDER BY updated_at DESC 
            LIMIT ? OFFSET ?
        `).all(user.id, limit, offset) as any[];

        return NextResponse.json({
            sessions,
            total: stats.total,
            totalPages: Math.ceil(stats.total / limit),
            currentPage: page
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
