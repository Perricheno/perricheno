import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { addPurchasedTokens, checkAndDeductUsage, PLAN_LIMITS } from "@/lib/db";
import { createTestUser } from "./helpers";

describe("addPurchasedTokens - boundary cases", () => {
    it("amount = 0: balance unchanged, no ledger Transaction row created", async () => {
        const user = await createTestUser({ purchased_chars: 100 });
        await addPurchasedTokens(user.id, "chars", 0);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(100);

        const txCount = await prisma.transaction.count({ where: { user_id: user.id } });
        expect(txCount).toBe(0); // guarded by `if (amount > 0)` in the source
    });

    it("normal positive amount: balance increases and a Transaction row is logged", async () => {
        const user = await createTestUser({ purchased_chars: 100 });
        await addPurchasedTokens(user.id, "chars", 500);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(600);

        const tx = await prisma.transaction.findFirst({ where: { user_id: user.id } });
        expect(tx?.is_positive).toBe(true);
    });

    // KNOWN GAP - documented here, not silently "fixed", per the Phase 3 brief
    // (test what the money-mutation code actually does at 0/negative/overflow
    // boundaries). addPurchasedTokens has no guard against a negative `amount`:
    // Prisma's `increment` is applied unconditionally, only the *ledger record*
    // is skipped for non-positive amounts (`if (amount > 0)`). In the current
    // codebase every call site passes a hardcoded positive catalog value, so
    // this isn't reachable by an attacker today - but there is no structural
    // protection stopping a future caller from silently debiting a user with
    // zero trace in the Transaction ledger. Flagged as a new REVIEW.md finding
    // rather than changed here, since Phase 3's brief is tests, not fixes.
    it("[KNOWN GAP] a negative amount silently DECREASES the balance with no ledger trace", async () => {
        const user = await createTestUser({ purchased_chars: 1000 });
        await addPurchasedTokens(user.id, "chars", -400);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(600); // decreased - Prisma `increment` with a negative delta

        const txCount = await prisma.transaction.count({ where: { user_id: user.id } });
        expect(txCount).toBe(0); // and completely untracked in the Transaction ledger
    });

    // KNOWN GAP - same function, same root cause: no floor check, so a large
    // enough negative amount drives the balance below zero.
    it("[KNOWN GAP] a large negative amount can drive purchased_chars negative", async () => {
        const user = await createTestUser({ purchased_chars: 100 });
        await addPurchasedTokens(user.id, "chars", -500);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(-400);
    });
});

describe("checkAndDeductUsage('chars') - boundary cases", () => {
    it("succeeds and deducts from the free weekly/monthly quota first, before touching purchased_chars", async () => {
        const user = await createTestUser({ purchased_chars: 1000 });
        const result = await checkAndDeductUsage(user.id, "chars", 100);
        expect(result.success).toBe(true);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.weekly_chars_used).toBe(100);
        expect(updated.purchased_chars).toBe(1000); // untouched - free quota covered it
    });

    it("spills over into purchased_chars once the free weekly/monthly quota is exhausted", async () => {
        // Note: seeding weekly_chars_used directly doesn't work here - a fresh
        // user has last_week_reset=null, so the very first call's own
        // "reset stale weekly counter" branch would zero it out again before
        // the deduction math runs. Drive the user to the target state through
        // real calls instead, the way production traffic actually would.
        const freeWeekly = PLAN_LIMITS.free.weekly_chars;
        const user = await createTestUser({ purchased_chars: 500 });

        const prime = await checkAndDeductUsage(user.id, "chars", freeWeekly - 50);
        expect(prime.success).toBe(true);

        // Only 50 free chars left this week; ask for 200 -> 50 from free, 150 from purchased.
        const result = await checkAndDeductUsage(user.id, "chars", 200);
        expect(result.success).toBe(true);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.weekly_chars_used).toBe(freeWeekly);
        expect(updated.purchased_chars).toBe(350); // 500 - 150
    });

    it("fails closed (no partial deduction) when neither free quota nor purchased balance covers the request", async () => {
        const freeWeekly = PLAN_LIMITS.free.weekly_chars;
        const user = await createTestUser({ purchased_chars: 0 });

        const prime = await checkAndDeductUsage(user.id, "chars", freeWeekly);
        expect(prime.success).toBe(true); // uses up the entire free weekly quota in one shot

        const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

        const result = await checkAndDeductUsage(user.id, "chars", 1);
        expect(result.success).toBe(false);
        expect(result.remaining).toBe(0);

        const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(after.weekly_chars_used).toBe(before.weekly_chars_used);
        expect(after.purchased_chars).toBe(before.purchased_chars);
    });

    it("amount = 0 succeeds as a no-op and does not log a UsageLog row", async () => {
        const user = await createTestUser({ purchased_chars: 100 });
        const result = await checkAndDeductUsage(user.id, "chars", 0);
        expect(result.success).toBe(true);

        const logCount = await prisma.usageLog.count({ where: { user_id: user.id } });
        expect(logCount).toBe(0); // guarded by `if (amount > 0)` in the source

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(100);
    });

    // KNOWN GAP: a negative `amount` is never rejected by the `totalAvailable
    // < amount` check (total is always >= 0, so it's never less than a
    // negative number), and Math.min/subtraction with a negative delta
    // actually REFUNDS quota instead of consuming it. Whether this is
    // reachable depends on every current caller only ever passing a
    // non-negative, server-computed amount - not verified for every call
    // site as part of this test-writing pass. Documented, not fixed, and
    // flagged as a new REVIEW.md finding.
    it("[KNOWN GAP] a negative amount REFUNDS quota instead of being rejected", async () => {
        const user = await createTestUser({ purchased_chars: 100 });
        // Prime real usage first (see the note on the previous test for why
        // seeding weekly_chars_used directly doesn't stick).
        const prime = await checkAndDeductUsage(user.id, "chars", 300);
        expect(prime.success).toBe(true);
        const primed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(primed.weekly_chars_used).toBe(300);

        const result = await checkAndDeductUsage(user.id, "chars", -50);
        expect(result.success).toBe(true);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        // The "used" counter goes DOWN from a "usage" call - a real refund,
        // the opposite of what checkAndDeductUsage is meant to do.
        expect(updated.weekly_chars_used).toBe(250);
        expect(updated.purchased_chars).toBe(100); // unaffected in this particular case, since fromFree covers all of it
    });
});
