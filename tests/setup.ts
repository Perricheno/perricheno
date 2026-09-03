// Vitest setup - runs before each test file loads.
//
// Requires a real, disposable Postgres reachable via DATABASE_URL, already
// migrated with `npx prisma db push` (see tests/README.md). Tests hit this
// database for real - nothing here is mocked, matching how every fix in this
// audit was verified by hand.

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is not set. Tests need a real disposable Postgres - " +
        "see tests/README.md for the one-line docker command."
    );
}

process.env.SESSION_SECRET ??= "test-session-secret-do-not-use-in-prod";
process.env.CRYPTOCLOUD_SECRET ??= "test-cryptocloud-secret";
process.env.WEBHOOK_SECRET ??= "test-webhook-secret";
process.env.WS_JWT_SECRET ??= "test-ws-jwt-secret";
process.env.TELEGRAM_BOT_TOKEN ??= "123456:test-telegram-bot-token";
// Deliberately NOT setting STIRLING_PDF_API_KEY / PADDLEOCR_API_TOKEN / etc. -
// nothing under test needs them, and leaving them unset also exercises the
// fail-closed guards added in Phase 1.
