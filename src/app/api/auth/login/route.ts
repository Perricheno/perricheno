import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramAuth } from "@/lib/telegram-auth";
import { upsertUser } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
    console.log("Login API Called");
    try {
        const data = await req.json();
        console.log("Login Payload:", data);

        const isValid = verifyTelegramAuth(data);

        if (!isValid) {
            console.error("Verification failed for user:", data.id);
            return NextResponse.json({ error: "Invalid signature or expired data" }, { status: 401 });
        }

        console.log("Auth Verified. Upserting user...");

        // Ensure ID is string for DB but comes as number from Telegram
        const user = upsertUser({
            telegram_id: String(data.id),
            username: data.username,
            first_name: data.first_name,
            photo_url: data.photo_url
        });

        console.log("User upserted:", user.id);

        await createSession(user.id);
        
        console.log("Session created.");

        return NextResponse.json({ success: true, user });
    } catch (e: any) {
        console.error("Login Route Error Full:", e);
        // Return more details for debugging
        return NextResponse.json({ 
            error: e.message || "Internal Server Error",
            details: e.toString(),
            stack: e.stack 
        }, { status: 500 });
    }
}
