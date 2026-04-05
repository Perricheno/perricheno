import { NextRequest, NextResponse } from "next/server";
import { getBotSession, updateBotSession } from "@/lib/db";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function GET(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const session = getBotSession(userId);
    return NextResponse.json({ session });
}

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { userId, session } = await req.json();
        if (!userId || !session) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        updateBotSession(String(userId), session);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
