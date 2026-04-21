-- Staged pipeline for /api/agent/generate
-- Run in Supabase SQL editor. Idempotent.

-- 1. Stage-progress tracking on sessions.
ALTER TABLE agent_sessions
    ADD COLUMN IF NOT EXISTS stage_json jsonb;

-- 2. Temporary server-side cache of parsed PDF bundles.
--    The client uploads a PDF once, server parses + stores, returns an id.
--    The generate call references these ids instead of re-uploading.
CREATE TABLE IF NOT EXISTS agent_uploads (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      integer NOT NULL,
    filename     text NOT NULL,
    text_content text NOT NULL DEFAULT '',
    images_json  jsonb NOT NULL DEFAULT '[]'::jsonb,
    char_count   integer NOT NULL DEFAULT 0,
    image_count  integer NOT NULL DEFAULT 0,
    page_count   integer NOT NULL DEFAULT 0,
    ocr_used     boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_agent_uploads_user    ON agent_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_uploads_expires ON agent_uploads(expires_at);

-- 3. Optional housekeeping — drop expired uploads nightly.
-- If pg_cron is available, schedule it. Otherwise a lightweight
-- `DELETE ... WHERE expires_at < now()` from the app is fine.
-- SELECT cron.schedule('cleanup-agent-uploads', '0 3 * * *',
--   $$DELETE FROM agent_uploads WHERE expires_at < now();$$);
