import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { telegram_id, sessionId, updateVisuals, page = 1, limit = 5 } = await req.json();

        // Single Session View
        if (sessionId && !updateVisuals) {
            const session = await prisma.agentSession.findUnique({
                select: { id: true, title: true, status: true, doc_type: true, error_msg: true, share_id: true, created_at: true, updated_at: true },
                where: { id: sessionId }
            });
            return NextResponse.json({ session });
        }

        // Update visuals_json for a session (called after compilation)
        if (sessionId && updateVisuals) {
            await prisma.agentSession.update({ where: { id: sessionId }, data: { visuals_json: updateVisuals, updated_at: new Date() } });
            return NextResponse.json({ success: true });
        }

        if (!telegram_id) return NextResponse.json({ error: "Missing telegram_id" }, { status: 400 });

        const user = await prisma.user.findFirst({ select: { id: true }, where: { telegram_id } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const offset = (page - 1) * limit;

        // Get sessions for agent reports
        const count = await prisma.agentSession.count({ where: { user_id: user.id } });
        const sessionsData = await prisma.agentSession.findMany({
            select: { id: true, title: true, status: true, created_at: true, updated_at: true },
            where: { user_id: user.id },
            orderBy: { updated_at: 'desc' },
            skip: offset,
            take: limit
        });
        const sessions = sessionsData || [];

        return NextResponse.json({
            sessions,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            currentPage: page
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        await prisma.agentSession.delete({ where: { id: sessionId } });
        
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
