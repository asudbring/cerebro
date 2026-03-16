-- Migration: Add iMessage support to digest_channels
-- Adds imessage_chat_guid column and updates the source constraint

-- Add iMessage column
alter table digest_channels add column if not exists imessage_chat_guid text;

-- Update source check constraint to include 'imessage'
alter table digest_channels drop constraint if exists digest_channels_source_check;
alter table digest_channels add constraint digest_channels_source_check
  check (source in ('teams', 'discord', 'imessage'));

-- Add unique constraint for iMessage chat channels
create unique index if not exists digest_channels_imessage_unique
  on digest_channels (source, imessage_chat_guid)
  where source = 'imessage';
