import { describe, it, expect } from "vitest";
import { createHmac, createHash } from "crypto";
import { verifyTelegramAuth } from "@/lib/telegram-auth";

function signPayload(fields: Record<string, string | number>): Record<string, string | number> {
    const secretKey = createHash("sha256").update(process.env.TELEGRAM_BOT_TOKEN!).digest();
    const validKeys = ["auth_date", "first_name", "id", "last_name", "photo_url", "username"];
    const checkString = Object.keys(fields)
        .filter((k) => validKeys.includes(k) && fields[k] != null)
        .sort()
        .map((k) => `${k}=${fields[k]}`)
        .join("\n");
    const hash = createHmac("sha256", secretKey).update(checkString).digest("hex");
    return { ...fields, hash };
}

describe("verifyTelegramAuth", () => {
    it("accepts a correctly-signed, fresh payload", () => {
        const payload = signPayload({ id: 12345, first_name: "Alice", auth_date: Math.floor(Date.now() / 1000) });
        expect(verifyTelegramAuth(payload)).toBe(true);
    });

    it("rejects a payload with a tampered field (hash no longer matches)", () => {
        const payload = signPayload({ id: 12345, first_name: "Alice", auth_date: Math.floor(Date.now() / 1000) });
        const tampered = { ...payload, id: 99999 }; // attacker changes the id after signing
        expect(verifyTelegramAuth(tampered)).toBe(false);
    });

    it("rejects a payload signed with the wrong bot token", () => {
        const wrongSecretKey = createHash("sha256").update("not-the-real-bot-token").digest();
        const fields = { id: 12345, first_name: "Alice", auth_date: Math.floor(Date.now() / 1000) };
        const checkString = `auth_date=${fields.auth_date}\nfirst_name=${fields.first_name}\nid=${fields.id}`;
        const badHash = createHmac("sha256", wrongSecretKey).update(checkString).digest("hex");
        expect(verifyTelegramAuth({ ...fields, hash: badHash })).toBe(false);
    });

    it("rejects a correctly-signed payload older than 24 hours", () => {
        const oldDate = Math.floor(Date.now() / 1000) - 86401; // 24h + 1s ago
        const payload = signPayload({ id: 12345, first_name: "Alice", auth_date: oldDate });
        expect(verifyTelegramAuth(payload)).toBe(false);
    });

    it("accepts a payload right at the 24-hour boundary minus a second", () => {
        const almostExpired = Math.floor(Date.now() / 1000) - 86399;
        const payload = signPayload({ id: 12345, first_name: "Alice", auth_date: almostExpired });
        expect(verifyTelegramAuth(payload)).toBe(true);
    });

    it("rejects a payload with no hash at all", () => {
        expect(verifyTelegramAuth({ id: 12345, first_name: "Alice" })).toBe(false);
    });
});
