import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { upsertUser } from "@/lib/db";
import { createSession } from "@/lib/session";

// Frontend polls this endpoint with the token to check if auth completed
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    try {
        const row = db
            .prepare("SELECT status, tg_user_data FROM auth_requests WHERE token = ?")
            .get(token) as any;

        if (!row) {
            return NextResponse.json({ status: "expired" });
        }

        if (row.status === "completed" && row.tg_user_data) {
            const tgUser = JSON.parse(row.tg_user_data);

            // Create session — same as normal login flow
            const user = upsertUser({
                telegram_id: String(tgUser.id),
                username: tgUser.username,
                first_name: tgUser.first_name,
                photo_url: tgUser.photo_url || "",
            });

            await createSession(user.id);

            // Clean up used token
            db.prepare("DELETE FROM auth_requests WHERE token = ?").run(token);

            return NextResponse.json({ status: "completed", user });
        }

        return NextResponse.json({ status: "pending" });
    } catch (err: any) {
        console.error("Poll error:", err);
        return NextResponse.json(
            { error: err.message || "Poll failed" },
            { status: 500 }
        );
    }
}
