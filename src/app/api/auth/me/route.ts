import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { getUserById, checkAndDeductUsage, LIMITS } from "@/lib/db";

export async function GET(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    // Auto-ping limits tracker to reset daily/weekly limits if date changed
    checkAndDeductUsage(userId, 'chars', 0);

    const user = getUserById(userId);
    if (!user) {
        return NextResponse.json({ user: null }, { status: 404 });
    }

    return NextResponse.json({ user, limits: LIMITS });
}
