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
  "source": "mcp | teams | discord | alexa"
}
```

## Setup

Run `schema.sql` in the Supabase SQL Editor, or see the [Getting Started guide](../../docs/01-getting-started.md) for step-by-step instructions.
