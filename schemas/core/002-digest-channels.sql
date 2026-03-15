-- Migration: digest_channels table
-- Tracks chat channels for proactive digest delivery (Teams, Discord).
-- Auto-populated when a user first captures a thought from a channel.

create table if not exists digest_channels (
  id uuid default gen_random_uuid() primary key,
  source text not null check (source in ('teams', 'discord')),

  -- Teams fields
  teams_service_url text,
  teams_conversation_id text,
  teams_user_name text,

  -- Discord fields
  discord_channel_id text,
  discord_guild_id text,
  discord_channel_name text,

  -- Shared
  enabled boolean default true,
  last_digest_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One row per unique channel per source
  unique (source, teams_conversation_id),
  unique (source, discord_channel_id)
);

-- Index for the digest cron query
create index if not exists digest_channels_enabled_idx
  on digest_channels (enabled) where enabled = true;

-- Auto-update updated_at
create trigger digest_channels_updated_at
  before update on digest_channels
  for each row execute function update_updated_at();

-- RLS: service role only (Edge Functions use service role key)
alter table digest_channels enable row level security;
