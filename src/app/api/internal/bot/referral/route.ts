import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId, getReferralStats } from "@/lib/db";

export async function POST(req: NextRequest) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const authHeader = req.headers.get("X-Bot-Secret");

    if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { telegram_id } = await req.json();
        const user = await getUserByTelegramId(String(telegram_id));
        
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const stats = await getReferralStats(user.id);
        return NextResponse.json({ 
            success: true, 
            stats,
            referralLink: `https://t.me/perrichenobot?start=ref_${user.telegram_id}`
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
