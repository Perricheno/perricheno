import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertUser } from "@/lib/db";
import { createSession } from "@/lib/session";

// Frontend polls this endpoint with the token to check if auth completed
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    try {
        const row = await prisma.authRequest.findUnique({
            select: { status: true, tg_user_data: true },
            where: { token }
        });

        if (!row) {
            return NextResponse.json({ status: "expired" });
        }

        if (row.status === "completed" && row.tg_user_data) {
            const tgUser = JSON.parse(row.tg_user_data);

            // Create session - same as normal login flow
            const user = await upsertUser({
                telegram_id: String(tgUser.id),
                username: tgUser.username,
                first_name: tgUser.first_name,
                photo_url: tgUser.photo_url || "",
            });

            const sessionData = await createSession(user.id);

            // Send Security Notification via Telegram
            const { sendTelegramNotification } = await import("@/lib/db");
            const alertText = `🔔 *Безопасность: Новый вход*\n\n` +
                              `Обнаружен новый вход в ваш аккаунт Perricheno.\n\n` +
                              `📱 *Устройство:* \`${sessionData.ua.split(' (')[0]}\`\n` +
                              `🌍 *Место:* \`${sessionData.location}\`\n` +
                              `📍 *IP:* \`${sessionData.ip}\`\n\n` +
                              `_Если это были не вы, немедленно завершите все сессии в настройках бота._`;
            
            await sendTelegramNotification(user.id, alertText).catch(e => console.error("Notification failed", e));

            // Clean up used token
            await prisma.authRequest.delete({ where: { token } });

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
