import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const sessionId = req.nextUrl.searchParams.get("sessionId");

    try {
        if (sessionId) {
            const messages = await prisma.chatMessage.findMany({
                where: { session_id: sessionId },
                select: { id: true, role: true, content: true, created_at: true },
                orderBy: { created_at: 'asc' }
            });

            return NextResponse.json({ 
                messages: messages.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    text: m.content,
                    timestamp: m.created_at
                }))
            });
        } else {
            const sessions = await prisma.chatSession.findMany({
                where: { user_id: userId },
                select: { id: true, title: true, created_at: true },
                orderBy: { updated_at: 'desc' }
            });

            return NextResponse.json({ 
                sessions: sessions.map((s: any) => ({ ...s, createdAt: s.created_at })) 
            });
        }
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const body = await req.json();
        const { action, sessionId, title, message } = body;

        if (action === "create_session") {
            await prisma.chatSession.create({
                data: { id: sessionId, user_id: userId, title }
            });
            return NextResponse.json({ success: true });
        }

        if (action === "save_message") {
            const { id, role, text, metadata } = message;
            
            const session = await prisma.chatSession.findUnique({
                where: { id: sessionId },
                select: { id: true }
            });

            if (!session) {
                await prisma.chatSession.create({
                    data: { id: sessionId, user_id: userId, title: title || "New Chat" }
                });
            }

            await prisma.$transaction([
                prisma.chatMessage.create({
                    data: {
                        id, session_id: sessionId, role, content: text,
                        metadata_json: JSON.stringify(metadata || {})
                    }
                }),
                prisma.chatSession.update({
                    where: { id: sessionId },
                    data: { updated_at: new Date() }
                })
            ]);

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
        await prisma.chatSession.deleteMany({
            where: { id: sessionId, user_id: userId }
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
