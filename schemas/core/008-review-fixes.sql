-- 008: Code review fixes
-- Addresses issues found during full codebase review:
--   1. Missing RLS policy on digest_channels (table was locked for everyone)
--   2. Add unique constraint on source_message_id for dedup atomicity
--   3. Remove redundant single-column status index (composite covers it)
--   4. Add file_type MIME format validation

-- 1. RLS policy for digest_channels — service role full access
-- The table had RLS enabled but no policy, making it inaccessible.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digest_channels' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON digest_channels
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 2. Unique constraint on source_message_id for atomic deduplication
-- Prevents race conditions in SELECT-then-INSERT dedup pattern.
-- Partial unique index (only non-null values) since most thoughts have no source_message_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_thoughts_source_message_id_unique
  ON thoughts (source_message_id)
  WHERE source_message_id IS NOT NULL;

-- Drop the old non-unique index (the unique index above replaces it)
DROP INDEX IF EXISTS idx_thoughts_source_message_id;

-- 3. Remove redundant single-column status index
-- The composite index idx_thoughts_status_type covers status-only queries
-- via left-prefix matching, so the standalone index is unnecessary overhead.
DROP INDEX IF EXISTS idx_thoughts_status;

-- 4. Add file_type MIME format validation
-- Ensures file_type values follow standard MIME type format (e.g., image/jpeg).
-- Allows NULL (most thoughts have no file).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'thoughts' AND constraint_name = 'thoughts_file_type_format'
  ) THEN
    ALTER TABLE thoughts ADD CONSTRAINT thoughts_file_type_format
      CHECK (file_type IS NULL OR file_type ~ '^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$');
  END IF;
END $$;
