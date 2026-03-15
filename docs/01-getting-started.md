# Build Your Cerebro

## What You're Building

A database that stores your thoughts with vector embeddings, plus an MCP server that lets any AI assistant search and write to your brain. Capture happens from whatever AI tool you're already using — Claude Desktop, ChatGPT, Claude Code, Cursor.

## What You Need

About 30 minutes and zero coding experience. You'll copy and paste everything.

### Services (All Free Tier)

- **[Supabase](https://supabase.com)** — Your database — stores everything
- **[OpenRouter](https://openrouter.ai)** — Your AI gateway — understands everything

### Cost

| Service | Cost |
| ------- | ---- |
| Supabase (free tier) | $0 |
| Embeddings (text-embedding-3-small) | ~$0.02 / million tokens |
| Metadata extraction (gpt-4o-mini) | ~$0.15 / million input tokens |

For 20 thoughts/day: roughly $0.10–0.30/month in API costs.

---

## Credential Tracker

You'll generate API keys, passwords, and IDs across services. Copy this into a text editor and fill it in as you go:

```text
CEREBRO -- CREDENTIAL TRACKER
Keep this file. Fill in as you go.
--------------------------------------

SUPABASE
  Account email:      ____________
  Account password:   ____________
  Database password:  ____________ <- Step 1
  Project name:       ____________
  Project ref:        ____________ <- Step 1
  Project URL:        ____________ <- Step 3
  Secret key:         ____________ <- Step 3

OPENROUTER
  Account email:      ____________
  Account password:   ____________
  API key:            ____________ <- Step 4

GENERATED DURING SETUP
  MCP Access Key:     ____________ <- Step 5
  MCP Server URL:     ____________ <- Step 6
  MCP Connection URL: ____________ <- Step 6

--------------------------------------
```

---

## Step 1: Create Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is fastest)
2. Click **New Project**
3. Pick your organization (default is fine)
4. Set Project name: `cerebro` (or whatever you want)
5. Generate a strong Database password — paste into credential tracker NOW
6. Pick the Region closest to you
7. Click **Create new project** and wait 1–2 minutes

> Grab your Project ref — it's the random string in your dashboard URL: `supabase.com/dashboard/project/THIS_PART`. Paste it into the tracker.

---

## Step 2: Set Up the Database

### Enable the Vector Extension

In the left sidebar: **Database → Extensions** → search for "vector" → flip **pgvector ON**.

### Create the Thoughts Table

In the left sidebar: **SQL Editor → New query** → paste and Run:

```sql
create table thoughts (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast vector similarity search
create index on thoughts
  using hnsw (embedding vector_cosine_ops);

-- Index for filtering by metadata fields
create index on thoughts using gin (metadata);

-- Index for date range queries
create index on thoughts (created_at desc);

-- Auto-update the updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger thoughts_updated_at
  before update on thoughts
  for each row
  execute function update_updated_at();
```

### Create the Search Function

New query → paste and Run:

```sql
create or replace function match_thoughts(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10,
  filter jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  created_at timestamptz
)
language plpgsql
as $$
begin
  return query
  select
    t.id,
    t.content,
    t.metadata,
    1 - (t.embedding <=> query_embedding) as similarity,
    t.created_at
  from thoughts t
  where 1 - (t.embedding <=> query_embedding) > match_threshold
    and (filter = '{}'::jsonb or t.metadata @> filter)
  order by t.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

### Lock Down Security

One more new query:

```sql
alter table thoughts enable row level security;

create policy "Service role full access"
  on thoughts
  for all
  using (auth.role() = 'service_role');
```

### Verify

Table Editor should show the `thoughts` table with columns: id, content, embedding, metadata, created_at, updated_at. Database → Functions should show `match_thoughts`.

---

## Step 3: Save Your Connection Details

In the left sidebar: **Settings** (gear icon) → **API**. Copy into your credential tracker:

- **Project URL** — Listed under "Project URL"
- **Secret key** — Under "API keys," the key formerly labeled "Service role key." Click reveal and copy.

> Treat the Secret key like a password. Anyone with it has full access to your data.

---

## Step 4: Get an OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai) and sign up
2. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
3. Click **Create Key**, name it `cerebro`
4. Copy the key into your credential tracker immediately
5. Add $5 in credits under Credits (lasts months)

---

## Step 5: Create an Access Key

Generate a random key in your terminal:

**Mac/Linux:**

```bash
openssl rand -hex 32
```

**Windows (PowerShell):**

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

Copy the output (64 characters). Paste into your credential tracker under MCP Access Key.

---

## Step 6: Deploy the MCP Server

### Install the Supabase CLI

**Mac (Homebrew):**

```bash
brew install supabase/tap/supabase
```

**Windows (Scoop):**

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Linux:**

```bash
npm install -g supabase
```

### Log In and Link

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### Set Your Secrets

```bash
supabase secrets set MCP_ACCESS_KEY=your-access-key-from-step-5
supabase secrets set OPENROUTER_API_KEY=your-openrouter-key-here
```

### Create and Deploy the Function

```bash
supabase functions new cerebro-mcp
```

Copy the contents of [`integrations/mcp-server/deno.json`](../integrations/mcp-server/deno.json) into `supabase/functions/cerebro-mcp/deno.json`.

Copy the contents of [`integrations/mcp-server/index.ts`](../integrations/mcp-server/index.ts) into `supabase/functions/cerebro-mcp/index.ts`.

Deploy:

```bash
supabase functions deploy cerebro-mcp --no-verify-jwt
```

Your MCP server is now live at:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp
```

Build your **MCP Connection URL**:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp?key=your-access-key
```

Paste both into your credential tracker.

---

## Step 7: Connect to Your AI

You need your MCP Connection URL from the credential tracker.

### Claude Desktop

1. Open Claude Desktop → **Settings** → **Connectors**
2. Click **Add custom connector**
3. Name: `Cerebro`
4. Remote MCP server URL: paste your **MCP Connection URL**
5. Click **Add**

### ChatGPT

Requires a paid ChatGPT plan. Works on web at [chatgpt.com](https://chatgpt.com).

1. Enable Developer Mode: Settings → Apps & Connectors → Advanced settings → toggle ON
2. Settings → Apps & Connectors → Create
3. Name: `Cerebro`
4. MCP endpoint URL: paste your **MCP Connection URL**
5. Authentication: **No Authentication** (key is in the URL)
6. Click **Create**

### Claude Code

```bash
claude mcp add --transport http cerebro \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp \
  --header "x-brain-key: your-access-key"
```

### Other Clients (Cursor, VS Code Copilot, Windsurf)

**Option A: URL with key.** Paste the full MCP Connection URL if your client supports remote MCP.

**Option B: mcp-remote bridge.** For clients that only support local stdio:

```json
{
  "mcpServers": {
    "cerebro": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp",
        "--header",
        "x-brain-key:${BRAIN_KEY}"
      ],
      "env": {
        "BRAIN_KEY": "your-access-key"
      }
    }
  }
}
```

---

## Step 8: Use It

| Prompt | Tool Used |
| ------ | --------- |
| "Save this: decided to move the launch to March 15" | Capture thought |
| "Remember that Marcus wants to move to the platform team" | Capture thought |
| "What did I capture about career changes?" | Semantic search |
| "What did I capture this week?" | Browse recent |
| "How many thoughts do I have?" | Stats |

Test with:

```text
Remember this: Sarah mentioned she's thinking about leaving her job to start a consulting business
```

Then search:

```text
What did I capture about Sarah?
```

---

## Troubleshooting

**Tools don't appear in Claude Desktop**
Make sure you added the connector in Settings → Connectors (not by editing the JSON config file). Verify it's enabled for your conversation.

**Getting 401 errors**
The access key doesn't match. Double-check the `?key=` value matches your MCP Access Key exactly.

**Search returns no results**
Capture at least one thought first. Try "search with threshold 0.3" for a wider net.

**Slow responses**
First call on a cold function takes a few seconds. Subsequent calls are faster. Check your Supabase region.

---

## How It Works Under the Hood

**Capture:** AI client → `capture_thought` MCP tool → embedding (1536-dim vector) + metadata extraction (LLM) in parallel → stored in Supabase → confirmation.

**Search:** AI client → `search_thoughts` → embed the query → pgvector cosine similarity → results ranked by meaning.

The embedding makes "Sarah's thinking about leaving" match "career changes" even with zero shared keywords.

### Swapping Models

Edit the model strings in `index.ts` and redeploy. Browse models at [openrouter.ai/models](https://openrouter.ai/models). Keep embedding dimensions at 1536 for compatibility.

---

## Next Steps

Once your MCP server is working, you can add more ways to capture thoughts:

| Integration | Guide | What It Does |
| ----------- | ----- | ------------ |
| Microsoft Teams | [Teams Setup](02-teams-capture-setup.md) | DM or @mention a bot in Teams |
| Discord | [Discord Setup](03-discord-capture-setup.md) | `/capture` and `/search` slash commands |
| Alexa | [Alexa Setup](04-alexa-setup.md) | "Alexa, tell cerebro …" voice commands |
| Calendar Reminders | [Reminders Setup](05-reminders-setup.md) | Auto-create O365/Google calendar events from captured dates |
| Daily Digest | [Digest Setup](06-daily-digest-setup.md) | Automated daily/weekly summaries to Teams + Discord |
