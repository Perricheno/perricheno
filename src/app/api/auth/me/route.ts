import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { getUserById } from "@/lib/db";

export async function GET(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = getUserById(userId);
    if (!user) {
        return NextResponse.json({ user: null }, { status: 404 });
    }

    return NextResponse.json({ user });
}
