-- Citation manager tables: personal library of scientific references
-- Each user has their own citations + optional folders (collections).

CREATE TABLE IF NOT EXISTS citations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     BIGINT NOT NULL,

    -- Canonical identifiers (any combination allowed, at least one recommended)
    doi         TEXT,                -- e.g. 10.1038/s41586-020-2649-2
    arxiv_id    TEXT,                -- e.g. 2303.12345
    isbn        TEXT,

    -- Metadata
    title       TEXT NOT NULL,
    authors     TEXT[] NOT NULL DEFAULT '{}',
    year        INTEGER,
    venue       TEXT,                -- journal / conference / publisher
    abstract    TEXT,
    url         TEXT,

    -- BibTeX: always stored — either imported or synthesized
    bibtex      TEXT NOT NULL,
    cite_key    TEXT NOT NULL,       -- the @article{KEY,...} key, unique per user

    -- User-side fields
    tags        TEXT[] NOT NULL DEFAULT '{}',
    notes       TEXT,
    starred     BOOLEAN NOT NULL DEFAULT FALSE,

    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, cite_key)
);

CREATE INDEX IF NOT EXISTS idx_citations_user        ON citations(user_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_citations_user_doi    ON citations(user_id, doi)      WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citations_user_arxiv  ON citations(user_id, arxiv_id) WHERE arxiv_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citations_tags        ON citations USING GIN (tags);

-- Collections (folders) — optional grouping
CREATE TABLE IF NOT EXISTS citation_collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     BIGINT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,                -- hex, used in UI
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON citation_collections(user_id, created_at DESC);

-- Many-to-many: citation ↔ collection
CREATE TABLE IF NOT EXISTS citation_collection_items (
    collection_id UUID NOT NULL REFERENCES citation_collections(id) ON DELETE CASCADE,
    citation_id   UUID NOT NULL REFERENCES citations(id)             ON DELETE CASCADE,
    added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, citation_id)
);

CREATE INDEX IF NOT EXISTS idx_citation_items_citation ON citation_collection_items(citation_id);

-- Auto-update updated_at on citation edits
CREATE OR REPLACE FUNCTION touch_citations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_citations_updated_at ON citations;
CREATE TRIGGER trg_citations_updated_at
    BEFORE UPDATE ON citations
    FOR EACH ROW EXECUTE FUNCTION touch_citations_updated_at();
