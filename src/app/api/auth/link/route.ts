import { NextResponse } from "next/server";
import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// Generate a unique deep link token for Telegram auth
export async function POST() {
    try {
        const token = uuidv4();

        db.prepare(
            "INSERT INTO auth_requests (token, status) VALUES (?, 'pending')"
        ).run(token);

        // Cleanup: delete tokens older than 10 minutes
        db.prepare(
            "DELETE FROM auth_requests WHERE created_at < datetime('now', '-10 minutes')"
        ).run();

        const botUsername = process.env.TELEGRAM_BOT_USERNAME || "PerrichenoBot";
        const deepLink = `https://t.me/${botUsername}?start=${token}`;

        return NextResponse.json({ token, deepLink });
    } catch (err: any) {
        console.error("Link generation error:", err);
        return NextResponse.json(
            { error: err.message || "Failed to generate link" },
            { status: 500 }
        );
    }
}
