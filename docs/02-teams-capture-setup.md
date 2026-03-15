# Teams Capture Setup

Capture thoughts from Microsoft Teams — DM the bot or @mention it in a channel.

## What You Need

- Working Cerebro setup ([Getting Started](01-getting-started.md) completed)
- Microsoft 365 tenant with Teams
- Azure subscription (Bot Channels Registration is **free** for Teams)
- Admin access to your M365 tenant (for sideloading the app)

## Credential Tracker

```text
TEAMS CAPTURE -- CREDENTIAL TRACKER
--------------------------------------

ENTRA ID APP REGISTRATION
  Application (client) ID:  ____________ <- Step 1
  Client secret value:      ____________ <- Step 1
  Tenant ID:                ____________ <- Step 1

AZURE BOT
  Bot handle:               ____________ <- Step 2
  Messaging endpoint:       ____________ <- Step 3

--------------------------------------
```

---

## Step 1: Register an App in Microsoft Entra ID

This creates the identity your bot uses to authenticate with the Bot Framework.

1. Go to the [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**
2. Click **New registration**
3. Name: `Cerebro Bot`
4. Supported account types: **Accounts in any organizational directory (Multitenant)**
5. Redirect URI: leave blank
6. Click **Register**

Copy the **Application (client) ID** and **Directory (tenant) ID** into your credential tracker.

### Create a Client Secret

1. In your new app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Description: `cerebro-bot-secret`
4. Expiry: choose your preference (24 months recommended)
5. Click **Add**
6. **Copy the Value immediately** — you won't see it again. Paste into your credential tracker.

---

## Step 2: Create an Azure Bot Resource

1. In the [Azure Portal](https://portal.azure.com), search for **Azure Bot** and click **Create**
2. Fill in:
   - **Bot handle**: `cerebro-bot` (or your preference)
   - **Subscription**: your Azure subscription
   - **Resource group**: create new or use existing
   - **Data residency**: Global
   - **Pricing tier**: **F0 (Free)** — this is all you need for Teams
   - **Type of App**: **Multi Tenant**
   - **Creation type**: **Use existing app registration**
   - **App ID**: paste your **Application (client) ID** from Step 1
3. Click **Review + Create** → **Create**
4. Wait for deployment to complete

### Enable the Teams Channel

1. Go to your new Azure Bot resource
2. Click **Channels** in the left sidebar
3. Click **Microsoft Teams**
4. Accept the terms
5. Click **Apply**

---

## Step 3: Deploy the Edge Function

### Set Your Secrets

From your Cerebro project directory (where you ran `supabase link`):

```bash
supabase secrets set TEAMS_BOT_APP_ID=your-application-client-id
supabase secrets set TEAMS_BOT_APP_SECRET=your-client-secret-value
```

> `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` should already be set from the initial setup.

### Create and Deploy the Function

```bash
supabase functions new cerebro-teams
```

Copy the contents of [`integrations/teams-capture/deno.json`](../integrations/teams-capture/deno.json) into `supabase/functions/cerebro-teams/deno.json`.

Copy the contents of [`integrations/teams-capture/index.ts`](../integrations/teams-capture/index.ts) into `supabase/functions/cerebro-teams/index.ts`.

Deploy:

```bash
supabase functions deploy cerebro-teams --no-verify-jwt
```

Your function is now live at:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-teams
```

### Set the Messaging Endpoint

1. Go back to your Azure Bot resource in the portal
2. Click **Configuration** in the left sidebar
3. Set **Messaging endpoint** to:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-teams
   ```
4. Click **Apply**

---

## Step 4: Create the Teams App Package

The Teams app manifest tells Teams about your bot. You need to customize it with your Bot App ID, then package it as a ZIP for sideloading.

### Update the Manifest

1. Open `integrations/teams-capture/teams-app/manifest.json`
2. Replace both instances of `{{BOT_APP_ID}}` with your **Application (client) ID** from Step 1

### Package the App

Create a ZIP file containing the three files from the `teams-app/` directory:

```bash
cd integrations/teams-capture/teams-app
zip cerebro-teams-app.zip manifest.json color.png outline.png
```

---

## Step 5: Sideload the App in Teams

### Enable Sideloading (Admin — One Time)

1. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
2. **Teams apps** → **Setup policies** → **Global (Org-wide default)**
3. Turn on **Upload custom apps**
4. Click **Save** (may take a few minutes to propagate)

### Upload the App

1. Open Microsoft Teams (desktop, web, or mobile)
2. Click **Apps** in the left sidebar
3. Click **Manage your apps** → **Upload an app**
4. Select **Upload a custom app**
5. Choose the `cerebro-teams-app.zip` file you created
6. Click **Add**

---

## Step 6: Test It

### Personal DM

1. In Teams, find **Cerebro** in your apps or chat list
2. Start a 1:1 chat with the bot
3. Type a thought:
   ```
   Sarah mentioned she's thinking about leaving her job to start a consulting business
   ```
4. You should see a confirmation reply with the extracted metadata

### Channel @mention

1. In any Team channel where the app is installed, type:
   ```
   @Cerebro Just had a great architecture review meeting with the platform team
   ```
2. The bot captures the thought (stripping the @mention) and replies in the thread

### Verify in Supabase

Open Supabase Dashboard → Table Editor → `thoughts`. You should see new rows with `metadata.source = "teams"`.

---

## Troubleshooting

**Bot doesn't respond**

- Check the messaging endpoint in Azure Bot Configuration — must be the exact Edge Function URL
- Verify secrets are set: `supabase secrets list` should show `TEAMS_BOT_APP_ID`, `TEAMS_BOT_APP_SECRET`, `OPENROUTER_API_KEY`
- Check Edge Function logs in Supabase Dashboard → Edge Functions → `cerebro-teams` → Logs

**Getting 401 errors in logs**

- The App ID or Secret may be wrong. Double-check they match your Entra ID app registration
- Ensure the app registration is set to **Multitenant** (required for Bot Framework)

**Sideloading not available**

- Admin must enable "Upload custom apps" in Teams Admin Center (Step 5)
- It can take up to 24 hours to propagate after enabling

**Bot appears but no reply**

- Check that the Edge Function deployed successfully: visit `https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-teams` in a browser — should return `{"status":"ok","service":"cerebro-teams"}`
- Check Supabase Edge Function logs for errors

**Slow first response**

- Cold start on Edge Functions takes a few seconds. Subsequent messages are faster.
