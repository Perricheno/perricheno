import { NextRequest, NextResponse } from "next/server";
import db, { getUserById, LIMITS } from "@/lib/db";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { telegram_id } = await req.json();
        if (!telegram_id) return NextResponse.json({ error: "Missing telegram_id" }, { status: 400 });

        const user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegram_id) as any;
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // Calculate limits
        const dailyMax = LIMITS.free.daily_chars;
        const weeklyMax = LIMITS.free.weekly_chars;
        
        const billing = {
            id: user.id,
            tier: user.account_tier || "free",
            daily_chars: {
                used: user.daily_chars_used || 0,
                max: dailyMax,
                remaining: Math.max(0, dailyMax - (user.daily_chars_used || 0))
            },
            weekly_chars: {
                used: user.weekly_chars_used || 0,
                max: weeklyMax,
                remaining: Math.max(0, weeklyMax - (user.weekly_chars_used || 0))
            },
            purchased: {
                chars: user.purchased_chars || 0,
                visuals: user.purchased_visuals || 0,
                reports: user.purchased_reports || 0
            },
            generations: {
                reports_daily: user.daily_reports_used || 0,
                reports_max: LIMITS.free.reports,
                visuals_daily: user.daily_visuals_used || 0
            },
            resets: {
                daily: user.last_reset_date,
                weekly: user.last_week_reset
            }
        };

        return NextResponse.json({ billing });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
