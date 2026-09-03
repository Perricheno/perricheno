import { NextRequest, NextResponse } from "next/server";
import { getBotSession, updateBotSession } from "@/lib/db";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userIdStr = searchParams.get("userId");
    const telegramId = searchParams.get("telegramId");

    if (telegramId) {
        const { getSessionsByUserId, getUserByTelegramId } = await import("@/lib/db");
        const user = await getUserByTelegramId(telegramId);
        if (!user) return NextResponse.json({ sessions: [] });
        const sessions = await getSessionsByUserId(user.id);
        return NextResponse.json({ sessions });
    }

    if (!userIdStr) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const session = await getBotSession(userIdStr);
    return NextResponse.json({ session });
}

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { userId, session, action, telegramId } = await req.json();

        const { getUserByTelegramId, deleteAllOtherSessions, updateBotSession } = await import("@/lib/db");

        if (action === 'terminate_others' && telegramId) {
            const user = await getUserByTelegramId(telegramId);
            if (user) {
                // Kill all sessions. Note: The current device will survive if it stays in its own cookie.
                // But from the bot's perspective, 'terminate_others' usually means log out of EVERYTHING ELSE.
                await deleteAllOtherSessions(user.id, 'bot-trigger'); 
                return NextResponse.json({ success: true });
            }
        }

        if (!userId || !session) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        await updateBotSession(String(userId), session);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
