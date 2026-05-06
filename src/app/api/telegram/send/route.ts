import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        if (!BOT_TOKEN) {
            console.error("TELEGRAM_BOT_TOKEN is not defined in environment variables");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        const formData = await req.formData();
        const file = formData.get("document");
        const chatId = formData.get("chat_id");

        if (!file || !chatId) {
            return NextResponse.json({ error: "Missing file or chat_id" }, { status: 400 });
        }

        const tgFormData = new FormData();
        tgFormData.append("chat_id", chatId);
        tgFormData.append("document", file);
        tgFormData.append("caption", "✅ Files processed by Perricheno PDF Tools");

        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
            method: "POST",
            body: tgFormData,
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("Telegram API Error:", err);
            return NextResponse.json({ error: "Telegram send failed", details: err }, { status: res.status });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Internal Telegram Error:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
