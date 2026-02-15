import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramAuth } from "@/lib/telegram-auth";
import { upsertUser } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();

        if (!verifyTelegramAuth(data)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const user = upsertUser({
            telegram_id: String(data.id),
            username: data.username,
            first_name: data.first_name,
            photo_url: data.photo_url
        });

        await createSession(user.id);

        return NextResponse.json({ success: true, user });
    } catch (e) {
        console.error("Login Error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
