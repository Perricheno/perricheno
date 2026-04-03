import { NextRequest, NextResponse } from "next/server";

const BOT_CONTAINER_URL = process.env.BOT_CONTAINER_URL || "http://telegram-bot:3001";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Telegram sends webhook updates to this public endpoint.
// We proxy them to the internal telegram-bot container.
export async function POST(req: NextRequest) {
    // Verify the request is from Telegram using the secret token
    const telegramSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (telegramSecret !== WEBHOOK_SECRET) {
        console.warn("[WEBHOOK] Invalid secret token received");
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.text();
        const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

        // Forward the raw update to the bot's internal webhook listener
        const res = await fetch(`${BOT_CONTAINER_URL}/webhook/${botToken}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET,
            },
            body,
        });

        return new NextResponse(null, { status: res.status });
    } catch (err) {
        console.error("[WEBHOOK] Proxy error:", err);
        return NextResponse.json({ error: "Proxy failed" }, { status: 502 });
    }
}
