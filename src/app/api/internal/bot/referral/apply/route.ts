import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId, upsertUser } from "@/lib/db";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const authHeader = req.headers.get("X-Bot-Secret");

    if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { invitee, referrerId } = await req.json();
        const existingInvitee = await getUserByTelegramId(String(invitee.id));
        const referrer = await getUserByTelegramId(String(referrerId));

        if (!referrer) {
            return NextResponse.json({ error: "Referrer not found" }, { status: 404 });
        }

        // Only award if it's a NEW user
        if (!existingInvitee) {
            // 1. Create the new user with referred_by
            const newUser = await upsertUser({
                telegram_id: String(invitee.id),
                username: invitee.username,
                first_name: invitee.first_name
            });
            
            await prisma.user.update({ where: { id: newUser.id }, data: { referred_by: referrer.id } });

            // 2. Award tokens to Referrer
            const bonus = 100000;
            await prisma.user.update({ where: { id: referrer.id }, data: { purchased_chars: referrer.purchased_chars + bonus } });

            // 3. Log transaction
            await prisma.transaction.create({ data: { user_id: referrer.id, topic: "Referral Bonus", amount_text: `+${bonus.toLocaleString()} chars`, is_positive: true } });

            return NextResponse.json({ success: true, awarded: true });
        }

        return NextResponse.json({ success: true, awarded: false, message: "User already registered" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
