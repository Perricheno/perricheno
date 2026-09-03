import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/[locale]/callback/route";
import { createTestUser } from "./helpers";

function sign(status: string, orderId: string) {
    const hashString = `${status}${orderId}${process.env.CRYPTOCLOUD_SECRET}`;
    return crypto.createHash("md5").update(hashString).digest("hex");
}

function postBody(fields: Record<string, string>) {
    return new URLSearchParams(fields).toString();
}

async function callWebhook(body: string) {
    const req = new Request("http://localhost/en/callback", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return POST(req as any);
}

// Regression test for REVIEW.md #1: this second CryptoCloud webhook used to
// log a signature mismatch and keep going anyway, and had no idempotency
// guard at all. Fixed in Phase 1 (commit 98f585c) to mirror
// /api/billing/webhook exactly - these tests are the same shape on purpose.
describe("POST /[locale]/callback (CryptoCloud, second webhook)", () => {
    it("rejects a request with no signature (used to fall through and credit anyway)", async () => {
        const orderId = `UID_1_PACK_starter_chars_TS_${Date.now()}`;
        const res = await callWebhook(postBody({ status: "success", order_id: orderId }));
        expect(res.status).toBe(403);
        expect(await res.text()).toBe("Missing signature");
    });

    it("rejects a request with a wrong signature (used to only log a warning)", async () => {
        const orderId = `UID_1_PACK_starter_chars_TS_${Date.now()}`;
        const res = await callWebhook(postBody({ status: "success", order_id: orderId, sign: "0".repeat(32) }));
        expect(res.status).toBe(403);
        expect(await res.text()).toBe("Invalid signature");
    });

    it("credits a fresh, validly-signed payment exactly once", async () => {
        const user = await createTestUser();
        const orderId = `UID_${user.id}_PACK_starter_chars_TS_${Date.now()}`;
        const body = postBody({ status: "success", order_id: orderId, sign: sign("success", orderId) });

        const res = await callWebhook(body);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("OK");

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(100_000);
    });

    it("does NOT credit twice on replay (used to have zero idempotency check)", async () => {
        const user = await createTestUser();
        const orderId = `UID_${user.id}_PACK_starter_chars_TS_${Date.now()}`;
        const body = postBody({ status: "success", order_id: orderId, sign: sign("success", orderId) });

        await callWebhook(body);
        const replay = await callWebhook(body);
        expect(replay.status).toBe(200);
        expect(await replay.text()).toBe("Already processed");

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(100_000);

        const payments = await prisma.processedPayment.count({ where: { order_id: orderId } });
        expect(payments).toBe(1);
    });

    it("correctly parses a package id containing underscores (used to break on split('_')[3])", async () => {
        // The pre-fix code used orderId.split('_')[3], which truncates any
        // packId with an underscore in it - i.e. every package except
        // "writer" and "researcher". "data_scientist" is a direct regression
        // check for that exact bug.
        const user = await createTestUser();
        const orderId = `UID_${user.id}_PACK_data_scientist_TS_${Date.now()}`;
        const res = await callWebhook(postBody({ status: "success", order_id: orderId, sign: sign("success", orderId) }));
        expect(res.status).toBe(200);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(2_000_000); // data_scientist pack
    });
});
