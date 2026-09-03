import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { createTestUser } from "./helpers";

// session.ts reads cookies()/headers() from next/headers, which only work
// inside a real Next.js request lifecycle. Mock them with a plain in-memory
// jar so we can unit-test the real JWT sign/verify + DB-session logic
// without booting a server - the standard pattern for testing App Router
// server-only utilities. x-forwarded-for is pinned to 127.0.0.1 so
// createSession's IP-geolocation lookup takes its "Localhost" short-circuit
// instead of making a real network call to ip-api.com.
let cookieJar = new Map<string, string>();
const fakeHeaders = new Map<string, string>([["user-agent", "vitest"], ["x-forwarded-for", "127.0.0.1"]]);

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
        set: (name: string, value: string) => { cookieJar.set(name, value); },
        delete: (name: string) => { cookieJar.delete(name); },
    }),
    headers: async () => ({
        get: (name: string) => fakeHeaders.get(name) ?? null,
    }),
}));

const { createSession, verifySession, deleteSession } = await import("@/lib/session");

beforeEach(() => {
    cookieJar = new Map();
});

describe("createSession / verifySession / deleteSession", () => {
    it("a freshly created session verifies back to the same userId", async () => {
        const user = await createTestUser();
        await createSession(user.id);

        const verified = await verifySession();
        expect(verified).toBe(user.id);
    });

    it("returns null when there is no session cookie at all", async () => {
        expect(await verifySession()).toBeNull();
    });

    it("returns null for a JWT signed with the wrong secret", async () => {
        const user = await createTestUser();
        await createSession(user.id); // creates a real Session row + valid cookie
        const realSessionId = [...cookieJar.keys()][0]; // sanity: exactly one cookie set

        const forgedSecret = new TextEncoder().encode("attacker-guessed-secret");
        const forgedToken = await new SignJWT({ sessionId: "does-not-matter", userId: user.id })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1d")
            .sign(forgedSecret);
        cookieJar.set("perricheno_session", forgedToken);

        expect(await verifySession()).toBeNull();
        expect(realSessionId).toBe("perricheno_session");
    });

    it("returns null for a token signed with the real secret but referencing a deleted Session row", async () => {
        const user = await createTestUser();
        await createSession(user.id);

        // Simulate the session having been revoked server-side (e.g. "log out
        // other devices") between issuing the cookie and using it.
        await prisma.session.deleteMany({ where: { user_id: user.id } });

        expect(await verifySession()).toBeNull();
    });

    it("returns null for an expired JWT even though the Session row still exists", async () => {
        const user = await createTestUser();
        const sessionId = crypto.randomUUID();
        await prisma.session.create({
            data: { id: sessionId, user_id: user.id, user_agent: "vitest", ip: "127.0.0.1", location: "Test" },
        });
        const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
        const expiredToken = await new SignJWT({ sessionId, userId: user.id })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
            .setExpirationTime(Math.floor(Date.now() / 1000) - 1) // already expired
            .sign(secret);
        cookieJar.set("perricheno_session", expiredToken);

        expect(await verifySession()).toBeNull();
        // The now-orphaned Session row is a separate, minor cleanup concern -
        // not asserted here since it's out of scope for this test.
    });

    it("deleteSession removes the cookie and the underlying Session row", async () => {
        const user = await createTestUser();
        await createSession(user.id);
        expect(await verifySession()).toBe(user.id);

        await deleteSession();

        expect(cookieJar.has("perricheno_session")).toBe(false);
        expect(await verifySession()).toBeNull();

        const remaining = await prisma.session.count({ where: { user_id: user.id } });
        expect(remaining).toBe(0);
    });
});
