import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
        const { data: row } = await supabase.from('auth_requests').select('status').eq('token', token).single();

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

        // Super Admin IDs (Hardcoded for total reliability)
        const SUPER_ADMINS = ['1153844209', '5934503762'];

        // Mark as completed with the user's data
        await supabase.from('auth_requests').update({ status: 'completed', tg_user_data: JSON.stringify(user) }).eq('token', token);

        // Ensure user exists and promote to admin if in SUPER_ADMINS
        if (SUPER_ADMINS.includes(String(user.id))) {
            try {
                // First, ensure the user record exists in the users table
                // (This table might be populated by bot initialization or first login)
                await supabase.from('users').upsert({
                    telegram_id: String(user.id),
                    username: user.username || "",
                    first_name: user.first_name || "",
                    is_admin: true
                }, { onConflict: 'telegram_id' });
                console.log(`🛡️ Super-admin ${user.id} promoted during login.`);
            } catch (e) {
                console.error("⚠️ Failed to auto-promote super-admin during verify:", e);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Bot verify error:", err);
        return NextResponse.json(
            { error: err.message || "Verification failed" },
            { status: 500 }
        );
    }
}
