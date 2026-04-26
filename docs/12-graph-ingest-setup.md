# Microsoft Graph Daily Ingest Setup

The `cerebro-graph-ingest` Edge Function pulls daily from Microsoft 365 (mail, calendar, OneNote, OneDrive/SharePoint files) and saves anything "worth learning" as `thoughts` rows. An AI gatekeeper decides save vs skip on a per-item basis, biased toward undersaving.

## What It Does

- **4 sources:** Outlook mail (`graph-mail`), calendar events (`graph-event`), OneNote pages (`graph-onenote`), OneDrive + SharePoint files (`graph-file`).
- **AI gatekeeper:** `gpt-4o-mini` (via OpenRouter) classifies each item; only those flagged "save" become thoughts. Calendar events with non-empty `bodyPreview` OR more than 2 attendees are always saved regardless of the classifier.
- **Hybrid storage:** AI-generated summary lands in `content` (embedded with `text-embedding-3-small`); raw Graph metadata is preserved in JSONB.
- **Action items** are extracted into `metadata.action_items[]` and surface in the next daily digest.
- **People** are extracted by the AI from message bodies (avoids the `People.Read.All` delegated-only restriction).
- **Dedup:** `source_message_id` = `<source>:<itemId>` (e.g. `graph-mail:AAMkAD...`).
- **High-water mark:** per-source watermark stored in `graph_ingest_state`; only items newer than the last successful run are pulled. Calendar uses a fixed `now-1d` to `now+2d` window.
- **Schedule:** daily at `0 11 * * *` UTC (1 hour before the daily digest at 12:00 UTC).

## Prerequisites

- Phase 1 (core infrastructure) complete.
- Phase 3 (calendar reminders) already deployed — this reuses the existing Entra ID app registration and these secrets:
  - `GRAPH_TENANT_ID`
  - `GRAPH_CLIENT_ID`
  - `GRAPH_CLIENT_SECRET`
  - `GRAPH_USER_ID` — the O365 user whose mailbox/calendar/notes/files will be ingested.
- `OPENROUTER_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (auto-provisioned).
- Tenant admin available to grant admin consent for new application permissions.

## Step 1: Add Graph API Permissions

The existing app needs four additional **application** (app-only) permissions on Microsoft Graph.

1. [Entra admin center](https://entra.microsoft.com) → **Identity** → **Applications** → **App registrations** → open the app you used for Teams / calendar reminders.
2. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**.
3. Add each of the following (search by name, tick the checkbox, **Add permissions**):

   | Permission | Why |
   |------------|-----|
   | `Mail.Read` | Read user mail |
   | `Calendars.Read` | Read user calendar events |
   | `Notes.Read.All` | Read OneNote pages |
   | `Files.Read.All` | Read OneDrive + SharePoint files |

   `Calendars.ReadWrite` should already be present from the Teams / reminders integration — leave it alone.

> **Why application permissions, not delegated?** The function runs unattended via pg_cron with no user session. Application permissions use the client-credentials grant (`scope=https://graph.microsoft.com/.default`).

## Step 2: Grant Admin Consent

Application permissions require tenant admin consent before they're usable.

**Option A — portal:** App registration → **API permissions** → **Grant admin consent for {tenant}** → confirm. Each row should flip to a green check under **Status**.

**Option B — direct URL** (open in a tenant admin browser session):

```text
https://login.microsoftonline.com/{tenant-id}/v2.0/adminconsent?client_id={client-id}&scope=https://graph.microsoft.com/.default
```

Replace `{tenant-id}` with `GRAPH_TENANT_ID` and `{client-id}` with `GRAPH_CLIENT_ID`. After consent, you'll be redirected to the app's reply URL — the redirect itself confirms success.

## Step 3: Verify the App-Only Token

From any shell with `curl`, fetch a token and call Graph as the configured user:

```bash
TENANT={tenant-id}
CLIENT={client-id}
SECRET={client-secret}
USER={graph-user-id-or-upn}

TOKEN=$(curl -s -X POST "https://login.microsoftonline.com/$TENANT/oauth2/v2.0/token" \
  -d "client_id=$CLIENT" -d "client_secret=$SECRET" \
  -d "scope=https://graph.microsoft.com/.default" \
  -d "grant_type=client_credentials" | jq -r .access_token)

curl -s "https://graph.microsoft.com/v1.0/users/$USER/messages?\$top=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.value[0].subject'
```

A subject line means consent + permissions are wired up. `401` = missing/invalid token, `403` = permission not consented, empty `value` = wrong `GRAPH_USER_ID` or empty mailbox.

## Step 4: Apply Migrations

```bash
npx supabase db query --linked < schemas/core/011-graph-ingest.sql
npx supabase db query --linked < schemas/core/012-graph-ingest-cron.sql
```

- `011-graph-ingest.sql` creates the `graph_ingest_state` table (`source` PK, `last_ingested_at`, `updated_at`), seeds rows for `mail`/`event`/`onenote`/`file`, and applies a `service_role`-only RLS policy.
- `012-graph-ingest-cron.sql` schedules the pg_cron job `cerebro-graph-ingest-daily` at `0 11 * * *` UTC.

## Step 5: Deploy the Function

```bash
cp integrations/cerebro-graph-ingest/index.ts  supabase/functions/cerebro-graph-ingest/index.ts
cp integrations/cerebro-graph-ingest/deno.json supabase/functions/cerebro-graph-ingest/deno.json
npx supabase functions deploy cerebro-graph-ingest --no-verify-jwt
```

No new secrets are needed — the function reuses existing `GRAPH_*`, `OPENROUTER_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

## Step 6: Manual Test

Trigger an on-demand mail ingest:

```bash
curl -X POST "https://livdhnxdbnhxxxlgcoge.supabase.co/functions/v1/cerebro-graph-ingest" \
  -H "x-brain-key: $BRAIN_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"mail"}'
```

Expected response shape:

```json
{
  "ok": true,
  "results": {
    "mail": { "pulled": 12, "saved": 3, "skipped": 9 }
  }
}
```

To run all four sources at once: `-d '{"source":"all"}'`.

Verify rows landed:

```bash
npx supabase db query --linked \
  "SELECT metadata->>'source' AS source, count(*) FROM thoughts \
   WHERE metadata->>'source' LIKE 'graph-%' GROUP BY 1"
```

## Step 7: Verify the Cron Schedule

```bash
npx supabase db query --linked \
  "SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'cerebro-graph-ingest-daily'"
```

Expected: one row, schedule `0 11 * * *`, `active = true`. The daily digest runs at `0 12 * * *` UTC, giving the ingest a 1-hour window to complete.

## Configuration

### Environment Variables

All reused from earlier phases — none new.

| Variable | Purpose |
|----------|---------|
| `GRAPH_TENANT_ID` | Entra tenant ID |
| `GRAPH_CLIENT_ID` | App registration client ID |
| `GRAPH_CLIENT_SECRET` | App registration secret |
| `GRAPH_USER_ID` | UPN or object ID of the M365 user to ingest |
| `OPENROUTER_API_KEY` | Embeddings + classifier |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron auth (`Authorization: Bearer …`) |
| `BRAIN_ACCESS_KEY` | Manual invocation auth (`x-brain-key`) |

### Request Body

```json
{ "source": "all" | "mail" | "event" | "onenote" | "file" }
```

`all` ingests every source sequentially. Single-source mode is useful for testing or replaying one channel.

### Source Tags

Stored as `metadata.source` on every saved thought. Used by the daily digest to bucket items.

| Tag | Source | Window |
|-----|--------|--------|
| `graph-mail` | Outlook mail | High-water mark from `graph_ingest_state` |
| `graph-event` | Calendar | Fixed `now-1d` to `now+2d` (always re-pulled) |
| `graph-onenote` | OneNote pages | High-water mark |
| `graph-file` | OneDrive + SharePoint files | High-water mark |

## Cost

Each ingest issues one classifier call per item plus one embedding per saved item. At ~50 items/day across all four sources with a ~30% save rate, expect well under $0.05/month in OpenRouter charges on top of Phase 1 baseline.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` from Graph | Token request failed — wrong client/secret/tenant | Re-verify `GRAPH_*` secrets; rotate the client secret if expired |
| `403 Forbidden` from Graph | Permission not consented | Re-run admin consent (Step 2); confirm green check on each permission |
| `AADSTS65001` in logs | User or admin has not consented to the application | Run admin consent URL in a tenant-admin browser session |
| Empty `value` array on every endpoint | Wrong `GRAPH_USER_ID` | Confirm UPN/object ID with `GET /users/{id}` |
| Function returns 200 but `saved: 0` for everything | Classifier rejecting all items (expected on quiet days) | Lower the bar by editing the classifier prompt, or check the logs for `skip` reasons |
| Duplicate rows appearing | `source_message_id` not set | Confirm the function is the one deployed (older versions lacked dedup) |
| Cron not firing at 11:00 UTC | `pg_cron` / `pg_net` extensions disabled | Enable both in **Database → Extensions** in the Supabase dashboard, then re-run `012-graph-ingest-cron.sql` |
| Calendar items always save even when "boring" | This is by design (always-save rule) | Tighten by editing the calendar branch in `index.ts` |

## See Also

- [Function reference](../integrations/cerebro-graph-ingest/README.md)
- [Daily digest setup](06-daily-digest-setup.md) — surfaces graph-ingested rows in the next morning's digest
- [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)
