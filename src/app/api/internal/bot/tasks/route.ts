import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId } from "@/lib/db";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const authHeader = req.headers.get("X-Bot-Secret");

    if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { telegram_id, action, sessionId } = await req.json();
        const user = await getUserByTelegramId(String(telegram_id));
        
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 1. Handle Task Reset/Cleanup
        if (action === "reset" && sessionId) {
            await prisma.agentSession.updateMany({
                where: { id: sessionId, user_id: user.id },
                data: { status: 'failed', error_msg: 'Manual reset via bot' }
            });
            return NextResponse.json({ success: true, message: "Task reset complete." });
        }

        // 2. Query Active Tasks
        const tasks = await prisma.agentSession.findMany({
            where: {
                user_id: user.id,
                status: { in: ['generating', 'processing', 'extracting'] }
            },
            select: { id: true, title: true, status: true, created_at: true },
            orderBy: { created_at: 'desc' }
        });

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
