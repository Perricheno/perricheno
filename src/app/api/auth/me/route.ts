import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { getUserById, checkAndDeductUsage, PLAN_LIMITS } from "@/lib/db";

export async function GET(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    // Auto-ping limits tracker to reset daily/weekly limits if date changed
    await checkAndDeductUsage(userId, 'chars', 0);

    const user = await getUserById(userId);
    if (!user) {
        return NextResponse.json({ user: null }, { status: 404 });
    }

    if (user.is_banned) {
        // Automatically revoke their access via frontend clearing if banned
        return NextResponse.json({ user: null, error: "Account suspended" }, { status: 403 });
    }

    const isAdmin = user.telegram_id === '1153844209';

    return NextResponse.json({ user: { ...user, isAdmin }, limits: PLAN_LIMITS });
}
