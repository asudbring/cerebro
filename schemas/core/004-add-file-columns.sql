-- Cerebro Schema Migration: Add File Attachment Columns
-- Run this in the Supabase SQL Editor AFTER the core schema (schema.sql)
-- and digest migrations (002, 003) are applied.

-- Add file attachment columns to the thoughts table
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Note: No additional indexes needed for file columns.
-- Filtering by has_file is done via metadata JSONB (already GIN-indexed).
