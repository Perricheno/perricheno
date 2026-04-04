import { NextRequest, NextResponse } from "next/server";
import db, { getUserByTelegramId, upsertUser } from "@/lib/db";

export async function POST(req: NextRequest) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const authHeader = req.headers.get("X-Bot-Secret");

    if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { invitee, referrerId } = await req.json();
        const existingInvitee = getUserByTelegramId(String(invitee.id));
        const referrer = getUserByTelegramId(String(referrerId));

        if (!referrer) {
            return NextResponse.json({ error: "Referrer not found" }, { status: 404 });
        }

        // Only award if it's a NEW user
        if (!existingInvitee) {
            // 1. Create the new user with referred_by
            const newUser = upsertUser({
                telegram_id: String(invitee.id),
                username: invitee.username,
                first_name: invitee.first_name
            });
            
            db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, newUser.id);

            // 2. Award tokens to Referrer
            const bonus = 100000;
            db.prepare('UPDATE users SET purchased_chars = purchased_chars + ? WHERE id = ?').run(bonus, referrer.id);

            // 3. Log transaction
            db.prepare(`
                INSERT INTO transactions (user_id, topic, amount_text, is_positive) 
                VALUES (?, ?, ?, ?)
            `).run(referrer.id, "Referral Bonus", `+${bonus.toLocaleString()} chars`, 1);

            return NextResponse.json({ success: true, awarded: true });
        }

        return NextResponse.json({ success: true, awarded: false, message: "User already registered" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
