import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/billing/webhook/route";
import { createTestUser, uniqueOrderId } from "./helpers";

function sign(status: string, orderId: string) {
    const hashString = `${status}${orderId}${process.env.CRYPTOCLOUD_SECRET}`;
    return crypto.createHash("md5").update(hashString).digest("hex");
}

function postBody(fields: Record<string, string>) {
    return new URLSearchParams(fields).toString();
}

async function callWebhook(body: string) {
    const req = new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return POST(req as any);
}

describe("POST /api/billing/webhook (CryptoCloud)", () => {
    it("rejects a request with no signature", async () => {
        const orderId = uniqueOrderId();
        const res = await callWebhook(postBody({ status: "success", order_id: orderId }));
        expect(res.status).toBe(403);
        expect(await res.text()).toBe("Missing signature");
    });

    it("rejects a request with a wrong signature", async () => {
        const orderId = uniqueOrderId();
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
        expect(updated.purchased_chars).toBe(100_000); // starter_chars pack

        const payment = await prisma.processedPayment.findUnique({ where: { order_id: orderId } });
        expect(payment).not.toBeNull();
    });

    it("does NOT credit twice when the same valid webhook is replayed", async () => {
        const user = await createTestUser();
        const orderId = `UID_${user.id}_PACK_starter_chars_TS_${Date.now()}`;
        const body = postBody({ status: "success", order_id: orderId, sign: sign("success", orderId) });

        const first = await callWebhook(body);
        expect(first.status).toBe(200);
        expect(await first.text()).toBe("OK");

        const replay = await callWebhook(body);
        expect(replay.status).toBe(200);
        expect(await replay.text()).toBe("Already processed");

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(100_000); // still just one pack's worth, not 200_000

        const payments = await prisma.processedPayment.count({ where: { order_id: orderId } });
        expect(payments).toBe(1);
    });

    it("ignores non-success statuses without crediting anything", async () => {
        const user = await createTestUser();
        const orderId = `UID_${user.id}_PACK_starter_chars_TS_${Date.now()}`;
        const body = postBody({ status: "pending", order_id: orderId, sign: sign("pending", orderId) });

        const res = await callWebhook(body);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("OK");

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.purchased_chars).toBe(0);
    });

    it("rejects a well-formed but unknown package id", async () => {
        const orderId = `UID_1_PACK_not_a_real_pack_TS_${Date.now()}`;
        const res = await callWebhook(postBody({ status: "success", order_id: orderId, sign: sign("success", orderId) }));
        expect(res.status).toBe(400);
        expect(await res.text()).toBe("Bad package data");
    });

    it("credits a subscription pack via upgradeSubscriptionPlan, not addPurchasedTokens", async () => {
        const user = await createTestUser();
        const orderId = `UID_${user.id}_PACK_pro_month_TS_${Date.now()}`;
        const res = await callWebhook(postBody({ status: "success", order_id: orderId, sign: sign("success", orderId) }));
        expect(res.status).toBe(200);

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updated.plan_tier).toBe("pro");
        expect(updated.account_tier).toBe("pro");
        expect(updated.monthly_chars_used).toBe(0);
    });
});
