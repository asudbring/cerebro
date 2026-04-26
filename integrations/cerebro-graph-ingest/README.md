# cerebro-graph-ingest

Edge Function that polls Microsoft Graph daily and saves M365 items "worth learning" as Cerebro thoughts. An AI gatekeeper classifies each item; only those flagged are kept.

For end-to-end setup (permissions, admin consent, migrations, cron), see [docs/12-graph-ingest-setup.md](../../docs/12-graph-ingest-setup.md).

## What It Does

- Pulls from 4 sources: Outlook mail, calendar events, OneNote pages, OneDrive + SharePoint files.
- App-only auth (client-credentials grant) — runs unattended via pg_cron.
- For each item: asks `gpt-4o-mini` (via OpenRouter) "is this worth saving?" — biased toward **undersaving**.
- For saved items: writes an AI summary to `content` (embedded with `text-embedding-3-small`) and preserves raw Graph metadata in JSONB.
- Calendar always-save rule: events with non-empty `bodyPreview` OR more than 2 attendees are kept regardless of the classifier verdict.
- Action items the AI extracts land in `metadata.action_items[]` (consumed by the daily digest).
- People are extracted by the AI from bodies (avoids `People.Read.All`'s delegated-only restriction).
- High-water mark per source in `graph_ingest_state`; calendar uses a fixed `now-1d` to `now+2d` window.

## Endpoint

`POST /functions/v1/cerebro-graph-ingest`

### Auth (either)

| Header | Used by |
|--------|---------|
| `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` | pg_cron |
| `x-brain-key: <BRAIN_ACCESS_KEY>` | Manual invocation |

### Request Body

```json
{ "source": "all" | "mail" | "event" | "onenote" | "file" }
```

Default if omitted: `all`.

### Response

```json
{
  "ok": true,
  "results": {
    "mail":    { "pulled": 12, "saved": 3, "skipped": 9 },
    "event":   { "pulled": 4,  "saved": 4, "skipped": 0 },
    "onenote": { "pulled": 0,  "saved": 0, "skipped": 0 },
    "file":    { "pulled": 7,  "saved": 1, "skipped": 6 }
  }
}
```

On failure, the responsible source has `error: "<message>"` and the others still run.

## Source Tags

Written to `metadata.source` on every saved thought.

| Tag | Source |
|-----|--------|
| `graph-mail` | Outlook mail |
| `graph-event` | Calendar event |
| `graph-onenote` | OneNote page |
| `graph-file` | OneDrive / SharePoint file |

## Dedup Key

`source_message_id` = `<source>:<itemId>` (example: `graph-mail:AAMkAD...`). Re-running the function on the same window is idempotent.

## Environment Variables

All reused — no new secrets required.

| Variable | Purpose |
|----------|---------|
| `GRAPH_TENANT_ID` | Entra tenant ID |
| `GRAPH_CLIENT_ID` | App registration client ID |
| `GRAPH_CLIENT_SECRET` | App registration secret |
| `GRAPH_USER_ID` | UPN or object ID of the M365 user to ingest |
| `OPENROUTER_API_KEY` | Classifier + embeddings |
| `SUPABASE_URL` | Auto-provisioned |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provisioned; also used as the cron Bearer token |
| `BRAIN_ACCESS_KEY` | Auth for manual invocation |

## Required Microsoft Graph Permissions

Application (app-only) permissions, admin consent required:

- `Mail.Read`
- `Calendars.Read`
- `Notes.Read.All`
- `Files.Read.All`

(`Calendars.ReadWrite` from the Teams/reminders app is left in place.)

## Cron Schedule

Defined in `schemas/core/012-graph-ingest-cron.sql`:

```text
jobname:  cerebro-graph-ingest-daily
schedule: 0 11 * * *      (UTC, 11:00)
```

The daily digest runs 1 hour later at `0 12 * * *`, so newly ingested rows appear in the next digest.

## Files

- `index.ts` — function source (~680 lines)
- `deno.json` — Deno import map (must be deployed alongside `index.ts`)

## Deployment

```bash
cp integrations/cerebro-graph-ingest/index.ts  supabase/functions/cerebro-graph-ingest/index.ts
cp integrations/cerebro-graph-ingest/deno.json supabase/functions/cerebro-graph-ingest/deno.json
npx supabase functions deploy cerebro-graph-ingest --no-verify-jwt
```

Both files must be copied — Supabase containers don't follow symlinks, and a missing `deno.json` causes "Relative import path not prefixed" errors.
