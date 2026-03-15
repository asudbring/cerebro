# Alexa Voice Integration Setup

Add voice capture and query to Cerebro via Amazon Alexa. Say **"Alexa, tell cerebro …"** to capture thoughts, search, manage tasks, get stats, and browse — all by voice.

Unlike the previous cerebro-oss design (which required AWS Lambda + 4 Zapier zaps), this integration runs entirely as a Supabase Edge Function — no Lambda, no Zapier, zero additional cost.

## Architecture

```
┌─────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│  Alexa       │────▶│  Supabase Edge Function   │────▶│  Supabase DB  │
│  Echo / App  │◀────│  (alexa-capture)          │◀────│  + pgvector   │
└─────────────┘     └──────────────────────────┘     └──────────────┘
   Voice I/O         Signature verify + intent        Embed + Store
                     routing + AI pipeline            + Query
```

## Prerequisites

- An Amazon account (same account linked to your Alexa devices)
- An [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) account (free — uses same Amazon account)
- Cerebro Supabase project deployed with the core schema and `OPENROUTER_API_KEY` set

## Credential Tracker

```text
ALEXA CAPTURE -- CREDENTIAL TRACKER
--------------------------------------

ALEXA DEVELOPER CONSOLE
  Skill ID:            ____________ <- Step 1

EDGE FUNCTION
  Function URL:        ____________ <- Step 2

--------------------------------------
```

---

## Step 1: Create the Alexa Skill

1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Click **Create Skill**
3. Configure:
   - **Skill name:** `Cerebro`
   - **Primary locale:** `English (US)`
   - **Type of experience:** `Other`
   - **Model:** `Custom`
   - **Hosting services:** `Provision your own` ← important — NOT Alexa-hosted
   - **Hosting region:** leave default
4. Click **Next** → choose **Start from Scratch** template → **Import Skill**

### Import the Interaction Model

1. In the Alexa Developer Console, go to **Build** → **Interaction Model** → **JSON Editor**
2. Paste the contents of [`integrations/alexa-capture/skill-package/interactionModels/custom/en-US.json`](../integrations/alexa-capture/skill-package/interactionModels/custom/en-US.json)
3. Click **Save**
4. Click **Build Skill** and wait for it to complete (~30 seconds)

### Note the Skill ID

1. Go to the skill's main page or **Build** → **Endpoint**
2. Copy the **Skill ID** (looks like `amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
3. Save it — you'll use it as `ALEXA_SKILL_ID` in Step 2

---

## Step 2: Deploy the Edge Function

### Set Environment Variables

```bash
# Required — your OpenRouter key (may already be set from MCP setup)
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key

# Optional but recommended — restricts to your skill only
supabase secrets set ALEXA_SKILL_ID=amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> **Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions.

### Create and Deploy the Function

```bash
supabase functions new cerebro-alexa
```

Copy the contents of [`integrations/alexa-capture/deno.json`](../integrations/alexa-capture/deno.json) into `supabase/functions/cerebro-alexa/deno.json`.

Copy the contents of [`integrations/alexa-capture/index.ts`](../integrations/alexa-capture/index.ts) into `supabase/functions/cerebro-alexa/index.ts`.

Deploy:

```bash
supabase functions deploy cerebro-alexa --no-verify-jwt
```

### Get the Edge Function URL

After deploying, your function URL will be:

```
https://<your-project-ref>.supabase.co/functions/v1/cerebro-alexa
```

---

## Step 3: Configure the Skill Endpoint

1. In the Alexa Developer Console, go to **Build** → **Endpoint**
2. Select **HTTPS**
3. In the **Default Region** field, paste your Edge Function URL:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/cerebro-alexa
   ```
4. For the SSL certificate type, select: **My development endpoint has a certificate from a trusted certificate authority**
   (Supabase uses Let's Encrypt / trusted CA certificates)
5. Click **Save Endpoints**

---

## Step 4: Test the Skill

### In the Developer Console

1. Go to the **Test** tab in the Alexa Developer Console
2. Set **Skill testing is enabled in:** `Development`
3. Type or speak test commands in the simulator:

| Say | Expected |
| --- | -------- |
| `open cerebro` | "Welcome to Cerebro. You can capture a thought..." |
| `tell cerebro I need to buy groceries` | "Captured: I need to buy groceries. Tagged as task." |
| `ask cerebro about groceries` | "I found 1 result. Best match: I need to buy groceries…" |
| `tell cerebro done buy groceries` | "Marked done: I need to buy groceries." |
| `tell cerebro reopen buy groceries` | "Reopened: I need to buy groceries." |
| `ask cerebro for stats` | "You have X thoughts. Most recent was today…" |
| `ask cerebro what's recent` | "Here are your 5 most recent thoughts…" |

### On Your Alexa Devices

Since the skill is in **Development** mode, it's automatically available on any Alexa device registered to the same Amazon account as your developer account. Just speak the commands above — no sideloading or publishing required.

Works on:
- **Echo devices** (all models)
- **Alexa app** (iOS / Android)
- **Fire tablets**
- **Any Alexa-enabled device**

---

## Step 5: (Optional) Tighten Security for Production

During development, you can set `ALEXA_SKIP_VERIFICATION=true` to bypass request signature verification. **Remove this before going live:**

```bash
# Remove the skip flag
supabase secrets unset ALEXA_SKIP_VERIFICATION

# Ensure skill ID is set
supabase secrets set ALEXA_SKILL_ID=amzn1.ask.skill.your-id-here
```

The Edge Function validates:
1. **Signature** — X.509 certificate chain from Amazon, RSA signature over request body
2. **Timestamp** — request must be within 150 seconds
3. **Skill ID** — must match your `ALEXA_SKILL_ID` (if set)

---

## Voice Command Reference

### Capture Thoughts

- "Alexa, tell cerebro `{thought}`"
- "Alexa, tell cerebro remember `{thought}`"
- "Alexa, tell cerebro capture `{thought}`"

### Search

- "Alexa, ask cerebro about `{query}`"
- "Alexa, ask cerebro search for `{query}`"
- "Alexa, ask cerebro what do I know about `{query}`"

### Complete Tasks

- "Alexa, tell cerebro done `{task}`"
- "Alexa, tell cerebro finished `{task}`"
- "Alexa, tell cerebro mark `{task}` as done"

### Reopen Tasks

- "Alexa, tell cerebro reopen `{task}`"
- "Alexa, tell cerebro undo `{task}`"

### Stats

- "Alexa, ask cerebro for stats"
- "Alexa, ask cerebro how many thoughts do I have"

### Browse Recent

- "Alexa, ask cerebro what's recent"
- "Alexa, ask cerebro latest thoughts"
- "Alexa, ask cerebro recent tasks" *(filter by type)*

### General

- "Alexa, open cerebro" *(launch and get help)*
- "Help" *(while skill is open)*
- "Stop" / "Cancel" *(exit)*

### Reminders (with Calendar Integration)

When you mention a date/time, Cerebro automatically creates calendar events if configured:

- "Alexa, tell cerebro set a reminder for Wednesday at 5 AM to review APIs"
- "Alexa, tell cerebro meeting with Sarah next Monday at 3pm"
- "Alexa, tell cerebro remind me to call the dentist tomorrow"

See **[Reminders Setup](05-reminders-setup.md)** to connect O365 and/or Google Calendar.

---

## Troubleshooting

**"There was a problem with the requested skill's response":**

- Check Edge Function logs: `supabase functions logs cerebro-alexa --project-ref YOUR_REF`
- Verify `OPENROUTER_API_KEY` is set correctly
- Ensure the core schema is deployed (thoughts table + match_thoughts function)

**Signature verification errors:**

- Ensure `ALEXA_SKIP_VERIFICATION` is NOT set to `true` in production
- Check that your Supabase function URL is HTTPS (it always is)
- The Edge Function must respond within 8 seconds — if AI calls are slow, check OpenRouter status

**"I didn't understand that":**

- Make sure the interaction model was built successfully (Build tab → "Build Successful")
- Try the exact phrases from the sample utterances
- Use the invocation name **cerebro**: "tell **cerebro**" or "ask **cerebro**"

**Skill not available on Echo device:**

- Ensure the skill is in "Development" mode on the Test tab
- The Alexa device must be registered to the same Amazon account as your developer account
- Try saying "Alexa, enable Cerebro" on the device
