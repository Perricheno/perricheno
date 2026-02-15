import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = "8270333686:AAEaQLlEmewJeVQ2FSZXDHrOFx_0eN4JQfI";
// Use POST to https://api.telegram.org/bot<token>/sendDocument

export async function POST(req: NextRequest) {
    try {
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
