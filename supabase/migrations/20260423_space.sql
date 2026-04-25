-- ============================================================
-- Perricheno Space - WorkSpace tables
-- ============================================================

-- Projects
CREATE TABLE IF NOT EXISTS spaces (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL DEFAULT 'Untitled Project',
    description  TEXT,
    compiler     TEXT NOT NULL DEFAULT 'pdflatex',
    main_file    TEXT NOT NULL DEFAULT 'main.tex',
    auto_compile BOOLEAN NOT NULL DEFAULT true,
    share_id     TEXT UNIQUE,
    is_public    BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Files inside a project
CREATE TABLE IF NOT EXISTS space_files (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    path         TEXT NOT NULL,
    content      TEXT,
    content_b64  TEXT,
    is_binary    BOOLEAN NOT NULL DEFAULT false,
    mime_type    TEXT NOT NULL DEFAULT 'text/plain',
    size_bytes   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(space_id, path)
);

-- Version snapshots
CREATE TABLE IF NOT EXISTS space_versions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    created_by   INTEGER REFERENCES users(id),
    label        TEXT NOT NULL DEFAULT 'Auto-save',
    message      TEXT,
    snapshot     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Collaborators
CREATE TABLE IF NOT EXISTS space_collaborators (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT NOT NULL DEFAULT 'editor',
    invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at  TIMESTAMPTZ,
    UNIQUE(space_id, user_id)
);

-- Email invites
CREATE TABLE IF NOT EXISTS space_invites (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id     UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'editor',
    token        TEXT UNIQUE NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spaces_owner         ON spaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_space_files_space    ON space_files(space_id);
CREATE INDEX IF NOT EXISTS idx_space_versions_space ON space_versions(space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_space_collab_space   ON space_collaborators(space_id);
CREATE INDEX IF NOT EXISTS idx_space_collab_user    ON space_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_space_invites_token  ON space_invites(token);

-- Auto-update spaces.updated_at whenever a file changes
CREATE OR REPLACE FUNCTION touch_space_on_file_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE spaces SET updated_at = now() WHERE id = NEW.space_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_space_on_file ON space_files;
CREATE TRIGGER trg_touch_space_on_file
    AFTER INSERT OR UPDATE ON space_files
    FOR EACH ROW EXECUTE FUNCTION touch_space_on_file_change();
