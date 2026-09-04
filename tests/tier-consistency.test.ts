import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createTestUser, createTestSession } from "./helpers";

// Regression test for docs/REVIEW.md #20: `account_tier` and `plan_tier` used
// to coexist, but only `plan_tier` was ever read by checkAndDeductUsage's
// quota enforcement. The admin `set_tier` action and the bot's billing
// status action wrote/read `account_tier` instead, so an admin manually
// changing a user's tier never changed their real quota, and the bot
// displayed limits that didn't match what was actually enforced.
// `account_tier` has since been removed entirely; these tests confirm both
// call sites now agree on the one remaining field, `plan_tier`.

let cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
        set: (name: string, value: string) => { cookieJar.set(name, value); },
        delete: (name: string) => { cookieJar.delete(name); },
    }),
    headers: async () => ({
        get: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : "vitest"),
    }),
}));

const { PUT } = await import("@/app/api/admin/users/route");
const { POST: botBillingPOST } = await import("@/app/api/internal/bot/billing/route");

describe("account_tier/plan_tier consolidation (docs/REVIEW.md #20)", () => {
    it("admin set_tier action changes plan_tier, the field checkAndDeductUsage actually reads", async () => {
        cookieJar = new Map();
        // verifyAdmin() checks the real hardcoded admin telegram_id from
        // src/app/api/admin/users/route.ts - not a secret, already documented
        // as a known finding, safe to use against the disposable test DB.
        // upsert (not create) because this fixed ID persists across test runs
        // on a shared disposable DB, unlike the random-UUID users elsewhere.
        const admin = await prisma.user.upsert({
            where: { telegram_id: "1153844209" },
            update: {},
            create: { telegram_id: "1153844209", username: "admin_test" },
        });
        const cookieValue = await createTestSession(admin.id);
        cookieJar.set("perricheno_session", cookieValue);

        const target = await createTestUser({ plan_tier: "free" });

        const req = new Request("http://localhost/api/admin/users", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: target.id, action: "set_tier", tier: "pro" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(200);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
        expect(updated.plan_tier).toBe("pro");
        // No account_tier field exists anymore on the Prisma result at all.
        expect((updated as any).account_tier).toBeUndefined();
    });

    it("bot billing status action reports the tier from plan_tier", async () => {
        const user = await createTestUser({ plan_tier: "plus" });

        const req = new Request("http://localhost/api/internal/bot/billing", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-bot-secret": process.env.WEBHOOK_SECRET! },
            body: JSON.stringify({ action: "status", telegram_id: user.telegram_id }),
        });
        const res = await botBillingPOST(req as any);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.billing.tier).toBe("plus");
    });
});
