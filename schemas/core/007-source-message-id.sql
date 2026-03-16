-- 007: Add source_message_id column for deduplication
-- Stores the original message ID from capture sources (e.g., BlueBubbles message GUID)
-- to prevent duplicate captures when webhooks replay old messages.

ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS source_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_thoughts_source_message_id
  ON thoughts (source_message_id)
  WHERE source_message_id IS NOT NULL;
