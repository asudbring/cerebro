# Task Management Setup

Manage tasks with natural language across all Cerebro capture points. Complete, reopen, and delete tasks by simply describing them — Cerebro uses semantic matching to find the right one.

## What You Get

- **Complete tasks:** Say "done: quarterly report" and Cerebro finds and marks the matching task
- **Reopen tasks:** Change your mind with "reopen: quarterly report"
- **Delete thoughts:** Soft-delete any thought with "delete: old reminder"
- **Semantic matching:** No need for exact names — describe the task naturally
- **Works everywhere:** Teams (keyword prefixes), Discord (slash commands), Alexa (voice), MCP (AI tools)

## How It Works

1. You describe a task action (e.g., "done: prepare budget slides")
2. Cerebro generates an embedding for your description
3. Semantic search finds the closest matching thought/task
4. The thought's `status` column is updated (`open` → `done` / `deleted`)
5. Confirmation is sent back with the matched title and similarity score

## Status Values

| Status | Meaning |
|--------|---------|
| `open` | Default. Active thought/task |
| `done` | Completed task |
| `deleted` | Soft-deleted (hidden from queries, preserved in database) |

## Commands by Capture Source

### Teams (Keyword Prefixes)

Type these directly in chat with the bot:

| Action | Prefixes | Example |
|--------|----------|---------|
| Complete | `done:`, `completed:`, `finished:`, `complete:`, `shipped:`, `closed:` | `done: quarterly report` |
| Reopen | `reopen:`, `undo:`, `not done:`, `re-open:`, `undone:` | `reopen: quarterly report` |
| Delete | `delete:`, `remove:`, `trash:` | `delete: old test thought` |

### Discord (Slash Commands)

| Command | Usage |
|---------|-------|
| `/complete` | `/complete task:quarterly report` |
| `/reopen` | `/reopen task:quarterly report` |
| `/delete` | `/delete thought:old test thought` |

### Alexa (Voice)

| Intent | Example Phrases |
|--------|----------------|
| Complete | "tell cerebro done quarterly report", "tell cerebro finished the budget" |
| Reopen | "tell cerebro reopen quarterly report", "tell cerebro undo budget" |
| Delete | "tell cerebro delete old reminder", "tell cerebro remove test thought" |

### MCP (AI Tools)

Three new tools available to any connected AI client:

| Tool | Input | Description |
|------|-------|-------------|
| `complete_task` | `description` | Finds and completes a matching open task |
| `reopen_task` | `description` | Finds and reopens a matching completed task |
| `delete_task` | `description` | Soft-deletes a matching thought |

The `list_thoughts` tool now has a `status` filter (defaults to `open`, can be `done`, `deleted`, or `all`).

## Prerequisites

- ✅ Core infrastructure deployed (Phase 1 complete)
- ✅ At least one capture source configured
- ✅ Some tasks already captured (so you have something to complete/delete)

## Setup Steps

### Step 1: Run the Schema Migration

In the Supabase SQL Editor, run the contents of `schemas/core/005-add-status-column.sql`:

```sql
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
CREATE INDEX IF NOT EXISTS idx_thoughts_status ON thoughts (status);
CREATE INDEX IF NOT EXISTS idx_thoughts_status_type ON thoughts (status, ((metadata->>'type')));

-- Backfill existing metadata.status values
UPDATE thoughts SET status = metadata->>'status'
WHERE metadata->>'status' IS NOT NULL AND status = 'open' AND metadata->>'status' != 'open';
```

### Step 2: Redeploy Edge Functions

Redeploy all your active Edge Functions:

```bash
# MCP server (adds complete_task, reopen_task, delete_task tools)
supabase functions deploy mcp-server --no-verify-jwt

# Teams capture (if using Teams)
supabase functions deploy teams-capture --no-verify-jwt

# Discord capture (if using Discord)
supabase functions deploy discord-capture --no-verify-jwt

# Alexa capture (if using Alexa)
supabase functions deploy alexa-capture --no-verify-jwt

# Daily digest (updated queries)
supabase functions deploy daily-digest --no-verify-jwt
```

### Step 3: Register Discord Slash Commands (Discord only)

If using Discord, register the new commands:

```bash
curl -X PUT \
  "https://discord.com/api/v10/applications/YOUR_APP_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "capture",
      "description": "Capture a thought or file to Cerebro",
      "options": [
        { "name": "thought", "description": "The thought to capture", "type": 3 },
        { "name": "file", "description": "Attach a file to scan and store", "type": 11 }
      ]
    },
    {
      "name": "search",
      "description": "Search your brain",
      "options": [{ "name": "query", "description": "What to search for", "type": 3, "required": true }]
    },
    {
      "name": "complete",
      "description": "Mark a task as done",
      "options": [{ "name": "task", "description": "Describe the task to complete", "type": 3, "required": true }]
    },
    {
      "name": "reopen",
      "description": "Reopen a completed task",
      "options": [{ "name": "task", "description": "Describe the task to reopen", "type": 3, "required": true }]
    },
    {
      "name": "delete",
      "description": "Delete a thought or task",
      "options": [{ "name": "thought", "description": "Describe the thought to delete", "type": 3, "required": true }]
    }
  ]'
```

### Step 4: Update Alexa Skill (Alexa only)

If using Alexa, update the interaction model with the new DeleteTaskIntent. Re-deploy the skill package via the Alexa Developer Console or ASK CLI.

## 🚦 Verification

### Test 1: Capture a Task

1. In any capture source, send: "Remember to review the Q2 budget by Friday"
2. **Expected:** Captured as **task** with topics

### Test 2: Complete a Task

- **Teams:** `done: review budget`
- **Discord:** `/complete task:review budget`
- **Alexa:** "tell cerebro done review budget"
- **Expected:** `✅ **Marked done:** Review the Q2 budget by Friday (85% match)`

### Test 3: Reopen a Task

- **Teams:** `reopen: review budget`
- **Discord:** `/reopen task:review budget`
- **Expected:** `🔄 **Reopened:** Review the Q2 budget by Friday`

### Test 4: Delete a Thought

- **Teams:** `delete: review budget`
- **Discord:** `/delete thought:review budget`
- **Expected:** `🗑️ **Deleted:** Review the Q2 budget by Friday`

### Test 5: MCP Tools

1. Use `complete_task` with description "review budget" → task marked done
2. Use `list_thoughts` with `status: "done"` → shows completed tasks
3. Use `list_thoughts` with `status: "all"` → shows everything including deleted

### Test 6: Digest Excludes Deleted

1. Delete a thought, then trigger a digest
2. **Expected:** Deleted thoughts do not appear in the digest

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No matching open task found" | The thought may not be typed as "task", or similarity is below 0.3 |
| Task completes wrong match | Try a more specific description |
| Discord commands not showing | Re-register slash commands (Step 3) |
| Deleted thoughts still appear | Redeploy the daily-digest Edge Function |
| Alexa "delete" not working | Update the interaction model with DeleteTaskIntent |
