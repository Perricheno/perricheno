import { randomUUID } from "crypto";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

/** Creates a throwaway user with a unique telegram_id so tests never collide. */
export async function createTestUser(overrides: Partial<{
    plan_tier: string;
    purchased_chars: number;
    weekly_chars_used: number;
    monthly_chars_used: number;
    last_reset_date: string;
    last_week_reset: string;
}> = {}) {
    return prisma.user.create({
        data: {
            telegram_id: `test-${randomUUID()}`,
            username: "test_user",
            ...overrides,
        },
    });
}

/** Signs a real session JWT + creates the matching Session row, exactly like src/lib/session.ts's createSession(). */
export async function createTestSession(userId: number): Promise<string> {
    const sessionId = randomUUID();
    await prisma.session.create({
        data: { id: sessionId, user_id: userId, user_agent: "vitest", ip: "127.0.0.1", location: "Test" },
    });
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    return new SignJWT({ sessionId, userId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1d")
        .sign(secret);
}

export function uniqueOrderId(prefix = "UID"): string {
    return `${prefix}_TEST_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}
