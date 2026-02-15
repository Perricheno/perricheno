import { NextResponse } from "next/server";
import { verifySession, deleteSession } from "@/lib/session";
import { deleteUser } from "@/lib/db";

export async function DELETE() {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    deleteUser(userId);
    await deleteSession();

    return NextResponse.json({ success: true });
}
