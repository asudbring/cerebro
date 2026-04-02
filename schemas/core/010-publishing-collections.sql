-- Migration 010: Publishing Collections
-- Adds four tables for the fiction editing / publishing pipeline.
-- All tables follow the same pattern as `thoughts`:
--   content + embedding(1536) + metadata JSONB + timestamps
--
-- Prerequisites: pgvector extension enabled (migration 001 / schema.sql)
--
-- Run via: npx supabase db query --linked < schemas/core/010-publishing-collections.sql

-- ============================================================
-- 1. Series Bible: persistent facts about a book series
-- ============================================================
CREATE TABLE IF NOT EXISTS cerebro_series_bible (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    series_name TEXT         NOT NULL,
    category    TEXT         NOT NULL,   -- 'character'|'worldbuilding'|'timeline'|'setting'|'plot_arc'
    entity_name TEXT,                    -- Character name, location, tech name, etc.
    content     TEXT         NOT NULL,
    embedding   vector(1536),
    metadata    JSONB        DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  DEFAULT now(),
    updated_at  TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_series_bible_series
    ON cerebro_series_bible (series_name);
CREATE INDEX IF NOT EXISTS idx_series_bible_category
    ON cerebro_series_bible (category);
CREATE INDEX IF NOT EXISTS idx_series_bible_entity
    ON cerebro_series_bible (entity_name);
CREATE INDEX IF NOT EXISTS idx_series_bible_embedding
    ON cerebro_series_bible
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_series_bible_metadata
    ON cerebro_series_bible USING gin (metadata);

CREATE TRIGGER series_bible_updated_at
    BEFORE UPDATE ON cerebro_series_bible
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cerebro_series_bible ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON cerebro_series_bible
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. Style Guide: author voice preferences and editorial rules
-- ============================================================
CREATE TABLE IF NOT EXISTS cerebro_style_guide (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    author_name TEXT         NOT NULL,   -- Pen name (e.g. 'Anika Thorne')
    section     TEXT         NOT NULL,   -- 'voice'|'avoid_words'|'prefer_words'|
                                         -- 'examples'|'anti_examples'|'formatting'|
                                         -- 'genre_conventions'
    content     TEXT         NOT NULL,
    embedding   vector(1536),
    metadata    JSONB        DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  DEFAULT now(),
    updated_at  TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_guide_author
    ON cerebro_style_guide (author_name);
CREATE INDEX IF NOT EXISTS idx_style_guide_section
    ON cerebro_style_guide (section);
CREATE INDEX IF NOT EXISTS idx_style_guide_embedding
    ON cerebro_style_guide
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_style_guide_metadata
    ON cerebro_style_guide USING gin (metadata);

CREATE TRIGGER style_guide_updated_at
    BEFORE UPDATE ON cerebro_style_guide
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cerebro_style_guide ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON cerebro_style_guide
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. Editorial History: findings from past editing pipeline runs
-- ============================================================
CREATE TABLE IF NOT EXISTS cerebro_editorial_history (
    id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    series_name     TEXT         NOT NULL,
    book_title      TEXT         NOT NULL,
    book_number     INT,
    pipeline_run_id TEXT,                -- UUID or timestamp of the pipeline run
    phase           TEXT         NOT NULL,   -- 'scan'|'structure'|'craft'|'line_notes'|
                                             -- 'continuity'|'rewrite'|'qa'|'summary'
    finding_type    TEXT         NOT NULL,   -- 'voice'|'pacing'|'continuity'|'craft'|
                                             -- 'prose'|'cliche'|'structure'|'pattern'
    severity        TEXT,                    -- 'critical'|'major'|'minor'|'info'
    content         TEXT         NOT NULL,
    chapter_ref     TEXT,
    embedding       vector(1536),
    metadata        JSONB        DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editorial_series
    ON cerebro_editorial_history (series_name);
CREATE INDEX IF NOT EXISTS idx_editorial_book
    ON cerebro_editorial_history (book_title);
CREATE INDEX IF NOT EXISTS idx_editorial_type
    ON cerebro_editorial_history (finding_type);
CREATE INDEX IF NOT EXISTS idx_editorial_phase
    ON cerebro_editorial_history (phase);
CREATE INDEX IF NOT EXISTS idx_editorial_embedding
    ON cerebro_editorial_history
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_editorial_metadata
    ON cerebro_editorial_history USING gin (metadata);

ALTER TABLE cerebro_editorial_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON cerebro_editorial_history
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 4. Cover Specs: design specifications for book covers
-- ============================================================
CREATE TABLE IF NOT EXISTS cerebro_cover_specs (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    series_name TEXT         NOT NULL,
    book_title  TEXT         NOT NULL,
    spec_type   TEXT         NOT NULL,   -- 'template'|'spec'|'palette'|'font_notes'
    content     TEXT         NOT NULL,
    embedding   vector(1536),
    metadata    JSONB        DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  DEFAULT now(),
    updated_at  TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cover_specs_series
    ON cerebro_cover_specs (series_name);
CREATE INDEX IF NOT EXISTS idx_cover_specs_book
    ON cerebro_cover_specs (book_title);
CREATE INDEX IF NOT EXISTS idx_cover_specs_embedding
    ON cerebro_cover_specs
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_cover_specs_metadata
    ON cerebro_cover_specs USING gin (metadata);

CREATE TRIGGER cover_specs_updated_at
    BEFORE UPDATE ON cerebro_cover_specs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE cerebro_cover_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON cerebro_cover_specs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 5. Semantic search functions (one per table)
-- ============================================================

CREATE OR REPLACE FUNCTION match_series_bible(
    query_embedding vector(1536),
    match_threshold float  DEFAULT 0.7,
    match_count     int    DEFAULT 10,
    filter          jsonb  DEFAULT '{}'
)
RETURNS TABLE (
    id          uuid,
    series_name text,
    category    text,
    entity_name text,
    content     text,
    metadata    jsonb,
    similarity  float,
    created_at  timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.series_name,
        t.category,
        t.entity_name,
        t.content,
        t.metadata,
        1 - (t.embedding <=> query_embedding) AS similarity,
        t.created_at
    FROM cerebro_series_bible t
    WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
      AND (filter = '{}'::jsonb OR t.metadata @> filter)
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_style_guide(
    query_embedding vector(1536),
    match_threshold float  DEFAULT 0.7,
    match_count     int    DEFAULT 10,
    filter          jsonb  DEFAULT '{}'
)
RETURNS TABLE (
    id          uuid,
    author_name text,
    section     text,
    content     text,
    metadata    jsonb,
    similarity  float,
    created_at  timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.author_name,
        t.section,
        t.content,
        t.metadata,
        1 - (t.embedding <=> query_embedding) AS similarity,
        t.created_at
    FROM cerebro_style_guide t
    WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
      AND (filter = '{}'::jsonb OR t.metadata @> filter)
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_editorial_history(
    query_embedding vector(1536),
    match_threshold float  DEFAULT 0.7,
    match_count     int    DEFAULT 10,
    filter          jsonb  DEFAULT '{}'
)
RETURNS TABLE (
    id              uuid,
    series_name     text,
    book_title      text,
    phase           text,
    finding_type    text,
    severity        text,
    content         text,
    chapter_ref     text,
    metadata        jsonb,
    similarity      float,
    created_at      timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.series_name,
        t.book_title,
        t.phase,
        t.finding_type,
        t.severity,
        t.content,
        t.chapter_ref,
        t.metadata,
        1 - (t.embedding <=> query_embedding) AS similarity,
        t.created_at
    FROM cerebro_editorial_history t
    WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
      AND (filter = '{}'::jsonb OR t.metadata @> filter)
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_cover_specs(
    query_embedding vector(1536),
    match_threshold float  DEFAULT 0.7,
    match_count     int    DEFAULT 10,
    filter          jsonb  DEFAULT '{}'
)
RETURNS TABLE (
    id          uuid,
    series_name text,
    book_title  text,
    spec_type   text,
    content     text,
    metadata    jsonb,
    similarity  float,
    created_at  timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.series_name,
        t.book_title,
        t.spec_type,
        t.content,
        t.metadata,
        1 - (t.embedding <=> query_embedding) AS similarity,
        t.created_at
    FROM cerebro_cover_specs t
    WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
      AND (filter = '{}'::jsonb OR t.metadata @> filter)
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
