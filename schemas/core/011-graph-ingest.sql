-- Migration 011: Graph Ingest State
--
-- Tracks high-watermark timestamps for the cerebro-graph-ingest Edge Function,
-- which pulls new mail, calendar events, OneNote pages, and OneDrive files from
-- Microsoft Graph and converts them into thoughts. Each source has its own
-- `last_ingested_at` cursor so the function can fetch only items modified since
-- the previous run.
--
-- Idempotent: safe to re-run.
-- Run via: npx supabase db query --linked < schemas/core/011-graph-ingest.sql

-- ============================================================
-- Table: graph_ingest_state
-- ============================================================
CREATE TABLE IF NOT EXISTS graph_ingest_state (
    source            TEXT        PRIMARY KEY,
    last_ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now() - interval '1 day',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default rows so the first run has a starting cursor for each source.
INSERT INTO graph_ingest_state (source) VALUES
    ('mail'),
    ('event'),
    ('onenote'),
    ('file')
ON CONFLICT (source) DO NOTHING;

-- ============================================================
-- Row Level Security: service_role only
-- ============================================================
ALTER TABLE graph_ingest_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON graph_ingest_state;
CREATE POLICY "Service role full access" ON graph_ingest_state
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- updated_at auto-update trigger
-- Reuses the update_updated_at() function defined in schema.sql.
-- ============================================================
DROP TRIGGER IF EXISTS graph_ingest_state_updated_at ON graph_ingest_state;
CREATE TRIGGER graph_ingest_state_updated_at
    BEFORE UPDATE ON graph_ingest_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
