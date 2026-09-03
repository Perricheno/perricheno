import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/internal/bot/billing/route";
import { createTestUser } from "./helpers";

async function callPromo(telegramId: string, code: string) {
    const req = new Request("http://localhost/api/internal/bot/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bot-secret": process.env.WEBHOOK_SECRET! },
        body: JSON.stringify({ action: "promo", telegram_id: telegramId, code }),
    });
    return POST(req as any);
}

async function createPromo(overrides: Partial<{ type: string; amount: number; max_uses: number; is_active: boolean }> = {}) {
    const code = `TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
    return prisma.promoCode.create({
        data: {
            code,
            type: overrides.type ?? "chars",
            amount: overrides.amount ?? 50_000,
            max_uses: overrides.max_uses ?? 10,
            is_active: overrides.is_active ?? true,
        },
    });
}

describe("Promo code redemption (internal/bot/billing action=promo)", () => {
    it("credits the correct resource type and amount on first use", async () => {
        const user = await createTestUser();
        const promo = await createPromo({ type: "chars", amount: 75_000 });

        const res = await callPromo(user.telegram_id, promo.code);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.amount).toBe(75_000);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(75_000);

        const promoRow = await prisma.promoCode.findUniqueOrThrow({ where: { id: promo.id } });
        expect(promoRow.uses).toBe(1);
    });

    it("rejects the SAME user redeeming the SAME promo twice, and does not double-credit", async () => {
        const user = await createTestUser();
        const promo = await createPromo({ type: "chars", amount: 20_000, max_uses: 10 });

        const first = await callPromo(user.telegram_id, promo.code);
        expect(first.status).toBe(200);

        const second = await callPromo(user.telegram_id, promo.code);
        expect(second.status).toBe(403);
        expect((await second.json()).error).toBe("Вы уже использовали этот промокод.");

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(20_000); // not 40_000

        const usages = await prisma.promoUsage.count({ where: { promo_id: promo.id, user_id: user.id } });
        expect(usages).toBe(1);
    });

    it("enforces max_uses across DIFFERENT users - the (N+1)th user is rejected, first N are credited", async () => {
        const promo = await createPromo({ type: "chars", amount: 10_000, max_uses: 1 });
        const userA = await createTestUser();
        const userB = await createTestUser();

        const resA = await callPromo(userA.telegram_id, promo.code);
        expect(resA.status).toBe(200);

        const resB = await callPromo(userB.telegram_id, promo.code);
        expect(resB.status).toBe(410);
        expect((await resB.json()).error).toBe("Лимит активаций исчерпан.");

        const a = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
        const b = await prisma.user.findUniqueOrThrow({ where: { id: userB.id } });
        expect(a.purchased_chars).toBe(10_000);
        expect(b.purchased_chars).toBe(0);

        const promoRow = await prisma.promoCode.findUniqueOrThrow({ where: { id: promo.id } });
        expect(promoRow.uses).toBe(1); // not 2 - the failed attempt must not increment uses
    });

    it("rejects an unknown code", async () => {
        const user = await createTestUser();
        const res = await callPromo(user.telegram_id, "THIS-CODE-DOES-NOT-EXIST");
        expect(res.status).toBe(404);
    });

    it("rejects a deactivated promo code", async () => {
        const user = await createTestUser();
        const promo = await createPromo({ is_active: false });
        const res = await callPromo(user.telegram_id, promo.code);
        expect(res.status).toBe(410);
        expect((await res.json()).error).toBe("Промокод деактивирован.");
    });

    it("rejects a call without the internal bot secret", async () => {
        const req = new Request("http://localhost/api/internal/bot/billing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "promo", telegram_id: "x", code: "x" }),
        });
        const res = await POST(req as any);
        expect(res.status).toBe(401);
    });
});
