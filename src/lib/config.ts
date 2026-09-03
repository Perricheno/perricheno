import 'server-only';

/**
 * Single source of truth for secrets that used to be hardcoded (or had
 * real-looking fallback literals) scattered across multiple files -
 * see docs/REVIEW.md, finding #3. No stand-in values here: if a secret
 * isn't set, callers get `undefined` and must fail closed instead of
 * silently using a guessable default.
 */

/** API key for the external Stirling PDF service (pdf.perricheno.ru). */
export const STIRLING_PDF_API_KEY = process.env.STIRLING_PDF_API_KEY;

/** Signing secret for short-lived Space collaboration websocket tokens. */
export const WS_JWT_SECRET = process.env.WS_JWT_SECRET;
