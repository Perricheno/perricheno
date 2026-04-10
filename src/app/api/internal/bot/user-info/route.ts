import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Internal endpoint for the bot to query user info by telegram_id
export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { telegram_id } = await req.json();

        if (!telegram_id) {
            return NextResponse.json({ error: "Missing telegram_id" }, { status: 400 });
        }

        const { data: user } = await supabase.from('users').select('*').eq('telegram_id', telegram_id).single();

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch (err: any) {
        console.error("User info error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
