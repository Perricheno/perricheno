import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Internal endpoint called by the telegram-bot container
// when a user sends /start <token> to the bot
export async function POST(req: NextRequest) {
    // Verify this is from our bot container
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { token, user } = await req.json();

        if (!token || !user?.id) {
            return NextResponse.json(
                { error: "Missing token or user data" },
                { status: 400 }
            );
        }

        // Check token exists and is pending
        const row = db
            .prepare("SELECT status FROM auth_requests WHERE token = ?")
            .get(token) as any;

        if (!row) {
            return NextResponse.json(
                { error: "Token not found or expired" },
                { status: 404 }
            );
        }

        if (row.status === "completed") {
            return NextResponse.json(
                { error: "Token already used" },
                { status: 409 }
            );
        }

        // Mark as completed with the user's data
        db.prepare(
            "UPDATE auth_requests SET status = 'completed', tg_user_data = ? WHERE token = ?"
        ).run(JSON.stringify(user), token);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Bot verify error:", err);
        return NextResponse.json(
            { error: err.message || "Verification failed" },
            { status: 500 }
        );
    }
}
