import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

// Generate a unique deep link token for Telegram auth
export async function POST() {
    try {
        const token = uuidv4();

        await supabase.from('auth_requests').insert({ token, status: 'pending' });

        // Cleanup: delete tokens older than 10 minutes
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        await supabase.from('auth_requests').delete().lt('created_at', tenMinAgo);

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
