# Core Schema

The foundational database schema for Cerebro.

## What It Creates

| Object | Type | Purpose |
| ------ | ---- | ------- |
| `thoughts` | Table | Stores captured thoughts with text, vector embeddings, and metadata |
| `match_thoughts` | Function | Semantic similarity search via pgvector |
| `update_updated_at` | Trigger function | Auto-updates `updated_at` on row changes |
| RLS policy | Policy | Restricts access to the `service_role` only |

## Table: `thoughts`

| Column | Type | Description |
| ------ | ---- | ----------- |
| `id` | `uuid` | Auto-generated primary key |
| `content` | `text` | The raw thought text |
| `embedding` | `vector(1536)` | OpenAI text-embedding-3-small vector |
| `metadata` | `jsonb` | Extracted metadata (topics, people, action_items, type, source) |
| `file_url` | `text` | Supabase Storage signed URL for attached file (nullable) |
| `file_type` | `text` | MIME type of attached file, e.g. `image/png` (nullable) |
| `created_at` | `timestamptz` | When the thought was captured |
| `updated_at` | `timestamptz` | Last modification time (auto-updated) |

## Indexes

- **HNSW** on `embedding` — fast approximate nearest-neighbor search
- **GIN** on `metadata` — efficient JSONB containment queries
- **B-tree** on `created_at DESC` — fast date-range lookups

## Metadata Schema

The `metadata` JSONB column follows this structure (extracted automatically by the AI pipeline):

```json
{
  "title": "Short descriptive title",
  "type": "idea | task | person_note | project_update | meeting_note | decision | reflection | reference | observation",
  "topics": ["topic1", "topic2"],
  "people": ["person1"],
  "action_items": ["todo1"],
  "has_reminder": false,
  "reminder_title": "",
  "reminder_datetime": "",
  "has_file": false,
  "file_name": "document.pdf",
  "file_description": "AI-generated description of file contents",
  "source": "mcp | teams | discord | alexa"
}
```

## Setup

Run the migrations in order in the Supabase SQL Editor:

1. **`schema.sql`** — Core thoughts table, vector index, RLS
2. **`002-digest-channels.sql`** — Digest delivery channel tracking
3. **`003-digest-cron.sql`** — pg_cron + pg_net scheduled digest jobs
4. **`004-add-file-columns.sql`** — File attachment columns (file_url, file_type)

See the [Getting Started guide](../../docs/01-getting-started.md) for step-by-step instructions.
