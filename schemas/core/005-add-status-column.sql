-- Cerebro Schema Migration: Add Status Column for Task Management
-- Run this in the Supabase SQL Editor AFTER migrations 001-004.

-- Add status column for task lifecycle tracking
-- Values: 'open' (default), 'done', 'deleted'
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

-- Index for fast status filtering
CREATE INDEX IF NOT EXISTS idx_thoughts_status ON thoughts (status);

-- Composite index for task queries (find open/done tasks by type)
CREATE INDEX IF NOT EXISTS idx_thoughts_status_type ON thoughts (status, ((metadata->>'type')));

-- Backfill: migrate any existing metadata.status values to the real column
UPDATE thoughts
SET status = metadata->>'status'
WHERE metadata->>'status' IS NOT NULL
  AND status = 'open'
  AND metadata->>'status' != 'open';
