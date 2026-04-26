# Build Your Cerebro

## What You're Building

A cloud-hosted database that turns your raw thoughts into searchable, AI-accessible knowledge. You'll set up a PostgreSQL instance with vector embeddings, deploy an MCP server on top of it, and connect your favourite AI tools so they can read and write to a shared memory.

## What You Need

Roughly 30 minutes. No programming required — every step is copy-and-paste.

### Services (All Free Tier)

- **[Supabase](https://supabase.com)** — Hosts the database and runs the server-side functions
- **[OpenRouter](https://openrouter.ai)** — Routes embedding and metadata-extraction calls to the right AI models

### Cost

| Component | Typical Cost |
| --------- | ------------ |
| Supabase (free tier) | $0 |
| Embeddings via text-embedding-3-small | ~$0.02 per million tokens |
| Metadata extraction via gpt-4o-mini | ~$0.15 per million input tokens |

At around 20 thoughts per day, expect roughly $0.10–0.30 per month in OpenRouter API charges.

---

## Credential Tracker

Throughout this guide you'll create accounts and generate keys. Keep them in one place so you can reference them later. Copy the block below into any text editor:

```text
CEREBRO CREDENTIALS
═══════════════════════════════

SUPABASE
  Email:              ____________
  Database password:  ____________  ← Step 1
  Project ref:        ____________  ← Step 1
  Project URL:        ____________  ← Step 3
  Service role key:   ____________  ← Step 3

OPENROUTER
  API key:            ____________  ← Step 4

CEREBRO
  MCP Access Key:     ____________  ← Step 5
  Server URL:         ____________  ← Step 6
  Connection URL:     ____________  ← Step 6

═══════════════════════════════
```

---

## Step 1: Create Your Supabase Project

Supabase provides the PostgreSQL database that stores your thoughts and the Edge Function runtime that hosts the MCP server.

1. Go to [supabase.com](https://supabase.com) and create an account (GitHub login works)
2. In the dashboard, click **New Project**
3. Choose an organization (the default is fine)
4. Name the project `cerebro` (or your preference)
5. Generate a database password — **copy it to your credential tracker now**
6. Select the region closest to you
7. Click **Create new project** and wait for provisioning (~1–2 minutes)

> Your **project ref** is the alphanumeric string in the dashboard URL: `supabase.com/dashboard/project/abcxyz123`. Copy it to your tracker.

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

Open the **Table Editor** in the sidebar — you should see a `thoughts` table with six columns (id, content, embedding, metadata, created_at, updated_at). Then check **Database → Functions** and confirm `match_thoughts` appears in the list.

---

## Step 3: Save Your Connection Details

Open the Supabase sidebar: **Settings** (gear icon) → **API**. Grab these two values and paste them into your credential tracker:

- **Project URL** — shown at the top of the API page
- **Secret key** — listed under "API keys" (previously called "Service role key"). Click the eye icon to reveal it, then copy.

> ⚠️ The secret key grants full database access. Keep it private — don't share it or commit it to a repo.

---

## Step 4: Get an OpenRouter API Key

OpenRouter acts as a single gateway to many AI models. Cerebro uses it for both embedding generation and metadata extraction.

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Navigate to [openrouter.ai/keys](https://openrouter.ai/keys)
3. Click **Create Key** and name it `cerebro`
4. Copy the key to your credential tracker right away
5. Under **Credits**, add $5 (this covers months of normal usage)

---

## Step 5: Create an Access Key

Your MCP server sits behind a public URL. To prevent unauthorized access, you'll generate a random key that the server checks on every request.

Run one of these commands in your terminal to produce a 64-character hex string:

**Mac/Linux:**

```bash
openssl rand -hex 32
```

**Windows (PowerShell):**

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

Save the output in your credential tracker under MCP Access Key — you'll set it as a Supabase secret in the next step.

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

Build your **MCP Connection URL** by setting the `x-brain-key` header to your access key:

```text
URL:  https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp
Header:  x-brain-key: your-access-key
```

Paste both into your credential tracker.

---

## Step 7: Connect to Your AI

Grab your MCP Connection URL from the credential tracker.

### Claude Desktop

1. Open Claude Desktop → **Settings** → **Connectors**
2. Click **Add custom connector**
3. Name: `Cerebro`
4. Remote MCP server URL: paste your **MCP Connection URL**
5. Click **Add**

Start a new conversation and Cerebro's tools will be available.

### ChatGPT

Requires a paid ChatGPT plan. Works on web at [chatgpt.com](https://chatgpt.com).

1. Go to Settings → **Apps & Connectors** → **Advanced settings** → toggle **Developer mode** ON
2. Back in **Apps & Connectors**, click **Create**
3. Name: `Cerebro`
4. MCP endpoint URL: paste your **MCP Connection URL**
5. Authentication: **No Authentication** (the key is embedded in the URL)
6. Click **Create**

If ChatGPT doesn't pick up the tools on its own, tell it explicitly: "Use the search_thoughts tool to find my notes about X."

### Claude Code

```bash
claude mcp add --transport http cerebro \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp \
  --header "x-brain-key: your-access-key"
```

### Other Clients (Cursor, VS Code Copilot, Windsurf)

**Option A: Remote URL.** If your client supports remote MCP servers, paste the full MCP Connection URL directly.

**Option B: mcp-remote bridge.** For clients that only support local stdio servers, use the `mcp-remote` npm package to bridge the connection:

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

## Step 8: Try It Out

Your AI client now has four Cerebro tools available. Here are some things to try:

| What to Say | What Happens |
| ----------- | ------------ |
| "Save this: decided to move the launch to March 15" | Captures the thought, extracts metadata automatically |
| "Remember that Marcus wants to move to the platform team" | Captures with people + topics detected |
| "What did I capture about career changes?" | Semantic search across all thoughts |
| "Show me what I captured this week" | Lists recent thoughts with date filters |
| "How many thoughts do I have?" | Returns totals, type breakdown, top topics |

**Quick test — capture:**

```text
Remember this: Sarah mentioned she's thinking about leaving her job to start a consulting business
```

You should see a confirmation with the auto-extracted type, topics, and people.

**Quick test — search:**

```text
What did I capture about Sarah?
```

This should return the thought above, even though you searched for "Sarah" and the thought contains "leaving her job." That's the vector similarity search at work.

---

## Troubleshooting

**Tools don't appear in Claude Desktop**
Check that the connector is added under Settings → Connectors and that it's toggled on for the current conversation.

**401 errors on every request**
The access key doesn't match what's stored in Supabase Secrets. Make sure your client sends the `x-brain-key` header with the exact value of your `MCP_ACCESS_KEY`.

**Search comes back empty**
Make sure you've captured at least one thought first. You can also try lowering the threshold: "search with threshold 0.3" casts a wider net.

**Responses take several seconds**
The first request after a period of inactivity wakes up the Edge Function (cold start). Follow-up calls in the same session are faster. If it stays slow, check that your Supabase project region is near you.

---

## Under the Hood

**Capture flow:** your text → `capture_thought` tool → two parallel API calls (embedding generation + LLM metadata extraction) → single row inserted into Supabase → confirmation returned.

**Search flow:** your query → `search_thoughts` tool → query gets embedded → pgvector cosine-similarity scan across all rows → results ranked by semantic closeness.

This is why "career changes" matches a note about "Sarah thinking about leaving" — the vectors encode meaning, not keywords.

### Changing AI Models

Since all model calls go through OpenRouter, you can swap to a different model by editing the model identifiers in `index.ts` and redeploying. Browse options at [openrouter.ai/models](https://openrouter.ai/models). Just keep embedding output at 1536 dimensions to stay compatible with existing data.

---

## ✅ Verification Checklist

Before moving on, confirm all of these pass:

- [ ] **Supabase Dashboard** → Table Editor shows `thoughts` table with 6 columns (id, content, embedding, metadata, created_at, updated_at)
- [ ] **Supabase Dashboard** → Database → Functions shows `match_thoughts`
- [ ] **Edge Function responds** — visiting `https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp` in a browser returns a page (not a 404 or 500)
- [ ] **Capture works** — in your AI client, say "Remember this: Sarah mentioned she's thinking about leaving her job to start a consulting business" → you get a confirmation with metadata (topics, people, type)
- [ ] **Search works** — ask "What did I capture about Sarah?" → returns the thought you just captured with a similarity score
- [ ] **Supabase data** — Table Editor → `thoughts` shows at least one row with `metadata.source` = `"mcp"` and a non-null `embedding`

> If any check fails, see the **Troubleshooting** section above.

---

## Next Steps

Once your MCP server is working, you can add more ways to capture thoughts. See the **[Cerebro Setup Guide](SETUP.md)** for the recommended order, or jump directly:

| Integration | Guide | What It Does |
| ----------- | ----- | ------------ |
| Microsoft Teams | [Teams Setup](02-teams-capture-setup.md) | DM or @mention a bot in Teams |
| Discord | [Discord Setup](03-discord-capture-setup.md) | `/capture` and `/search` slash commands |
| Alexa | [Alexa Setup](04-alexa-setup.md) | "Alexa, tell cerebro …" voice commands |
| Calendar Reminders | [Reminders Setup](05-reminders-setup.md) | Auto-create O365/Google calendar events from captured dates |
| Daily Digest | [Digest Setup](06-daily-digest-setup.md) | Automated daily/weekly summaries to Teams + Discord |
| Microsoft Graph daily ingest | [Graph Ingest Setup](12-graph-ingest-setup.md) | Once configured, your M365 mail / calendar / OneNote / OneDrive content auto-flows into Cerebro every morning |
