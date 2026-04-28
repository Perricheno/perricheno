import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

// Generate a unique deep link token for Telegram auth
export async function POST() {
    try {
        const token = uuidv4();

        await prisma.authRequest.create({ data: { token, status: 'pending' } });

        // Cleanup: delete tokens older than 10 minutes
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
        await prisma.authRequest.deleteMany({ where: { created_at: { lt: tenMinAgo } } });

        const botUsername = process.env.TELEGRAM_BOT_USERNAME || "PerrichenoBot";
        const deepLink = `https://t.me/${botUsername}?start=${token}`;

        return NextResponse.json({ token, deepLink });
    } catch (err: any) {
        console.error("Link generation error:", err);
        return NextResponse.json(
            { error: err.message || "Failed to generate link" },
            { status: 500 }
        );
    }
}
