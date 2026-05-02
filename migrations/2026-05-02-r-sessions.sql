-- R Studio session history
-- Run in Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS "RSession" (
    "id"           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id"      integer NOT NULL,
    "title"        text NOT NULL,
    "prompt"       text NOT NULL,
    "results_json" text,
    "status"       text NOT NULL DEFAULT 'generating',
    "created_at"   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RSession_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RSession_user_id_idx" ON "RSession"("user_id");

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_r_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS r_session_updated_at_trigger ON "RSession";
CREATE TRIGGER r_session_updated_at_trigger
    BEFORE UPDATE ON "RSession"
    FOR EACH ROW EXECUTE FUNCTION update_r_session_updated_at();
