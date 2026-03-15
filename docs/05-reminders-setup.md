# Calendar Reminders Setup

When Cerebro detects a date or time in a captured thought (e.g. "remind me to call the dentist next Wednesday at 5 AM"), it automatically creates a calendar event. This works across **all capture sources** — Teams, Discord, Alexa, and MCP.

You can configure one or both calendar backends. If neither is configured, reminders are still detected and stored in the thought metadata — they just won't create calendar events.

## How It Works

```
"Set a reminder for next Wednesday at 5AM to review the deployment"
     ↓
AI extracts: has_reminder=true, reminder_title="Review the deployment"
             reminder_datetime="2026-03-18T05:00:00-06:00"
     ↓
Edge Function creates calendar event(s) in parallel
     ↓
Confirmation: "⏰ Reminder created on O365 + Google"
```

The AI uses the current day-of-week and datetime to resolve relative dates like "next Wednesday", "tomorrow", "in two weeks". Default time is 09:00 Central (-06:00) if no time is specified.

---

## Option A: Office 365 Calendar (Exchange Online)

Uses the Microsoft Graph API with application permissions. Since you already have an O365 tenant and an Entra ID app (from Teams setup), you can reuse the same app registration.

### Step 1: Add Calendar Permission

1. Go to [Microsoft Entra admin center](https://entra.microsoft.com) → **App registrations** → select your Cerebro app
2. Go to **API permissions** → **Add a permission**
3. Select **Microsoft Graph** → **Application permissions**
4. Search for `Calendars.ReadWrite` → check it → **Add permissions**
5. Click **Grant admin consent for [your tenant]** → **Yes**

### Step 2: Set Environment Variables

```bash
# These may already be set from Teams setup — check first
supabase secrets set GRAPH_TENANT_ID=your-tenant-id
supabase secrets set GRAPH_CLIENT_ID=your-app-client-id
supabase secrets set GRAPH_CLIENT_SECRET=your-app-client-secret

# Your O365 email where calendar events will be created
supabase secrets set CALENDAR_USER_EMAIL=you@yourdomain.com
```

> **Note:** If you used a separate Entra ID app for Teams bot, you can reuse the same `GRAPH_CLIENT_ID`/`GRAPH_CLIENT_SECRET` — just add the `Calendars.ReadWrite` permission to it. Or create a dedicated app for calendar access.

### Step 3: Test

From any capture source, send a thought with a date:

- Teams: "remind me to check the deployment logs next Friday at 10am"
- Discord: `/capture thought:call the dentist tomorrow at 2pm`
- Alexa: "tell cerebro set a reminder for Wednesday at 5 AM to review APIs"
- MCP: use `capture_thought` with "meeting with Sarah next Monday at 3pm"

You should see the event appear on your O365 calendar within seconds.

---

## Option B: Google Calendar

Uses a Google Cloud service account. Works with personal Gmail — no Google Workspace required.

### Step 1: Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing) → name it `Cerebro`
3. Go to **APIs & Services** → **Library** → search **Google Calendar API** → **Enable**
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **Service Account**
   - Name: `cerebro-calendar`
   - Click **Create and Continue** → skip optional steps → **Done**
5. Click the service account you just created
6. Go to **Keys** → **Add Key** → **Create new key** → **JSON** → **Create**
7. A JSON file downloads — this contains your credentials

### Step 2: Share Your Calendar with the Service Account

1. Open [Google Calendar](https://calendar.google.com)
2. Find your calendar in the left sidebar → click the three dots → **Settings and sharing**
3. Under **Share with specific people or groups**, click **Add people and groups**
4. Enter the service account's email address (from the JSON file's `client_email` field — looks like `cerebro-calendar@your-project.iam.gserviceaccount.com`)
5. Set permission to **Make changes to events**
6. Click **Send**

### Step 3: Set Environment Variables

```bash
# The entire JSON key file content (as a single line)
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...","client_id":"..."}'

# Your Google Calendar ID (usually your Gmail address, or find it in calendar settings)
supabase secrets set GOOGLE_CALENDAR_ID=you@gmail.com
```

> **Tip:** To get the calendar ID: Google Calendar → Settings → click your calendar → **Integrate calendar** → **Calendar ID**

### Step 4: Test

Same as the O365 test above — send a thought with a date from any capture source and verify the event appears on your Google Calendar.

---

## Using Both Calendars

If both O365 and Google credentials are configured, Cerebro creates events on **both calendars in parallel**. The confirmation message will show which succeeded:

- `⏰ Reminder created on O365 + Google` — both worked
- `⏰ Reminder created on O365` — only O365 configured/working
- `⏰ Reminder created on Google` — only Google configured/working
- `⏰ Reminder detected but no calendar configured` — neither backend has credentials set

## Reminder Detection Examples

| Thought | Extracted Reminder |
| ------- | ------------------ |
| "remind me to call the dentist next Wednesday at 5 AM" | ✅ title: "Call the dentist", datetime: Wed 5:00 AM |
| "meeting with Sarah on March 20th" | ✅ title: "Meeting with Sarah", datetime: Mar 20 9:00 AM |
| "I need to review the API docs by Friday" | ✅ title: "Review the API docs", datetime: Fri 9:00 AM |
| "I decided to use PostgreSQL for the new project" | ❌ No reminder (no future date) |
| "groceries: milk, eggs, bread" | ❌ No reminder (no future date) |

## Environment Variables Reference

### O365 Calendar

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `GRAPH_TENANT_ID` | Yes | Your Azure AD / Entra tenant ID |
| `GRAPH_CLIENT_ID` | Yes | Entra ID app (client) ID |
| `GRAPH_CLIENT_SECRET` | Yes | Entra ID app client secret |
| `CALENDAR_USER_EMAIL` | Yes | O365 user email for calendar events |

### Google Calendar

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes | Full JSON key file content (single line) |
| `GOOGLE_CALENDAR_ID` | Yes | Target calendar ID (usually your email) |

## ✅ Verification Checklist

Before moving on, confirm all of these pass:

- [ ] **Capture with date** — from any source, capture a thought mentioning a future date (e.g., "remind me to check logs next Friday at 10am")
- [ ] **Calendar event created** — the event appears on your O365 and/or Google Calendar within a few seconds
- [ ] **Metadata stored** — in Supabase Table Editor, the thought's `metadata` contains `has_reminder: true`, `reminder_title`, and `reminder_datetime`
- [ ] **Non-reminder ignored** — capturing "I like PostgreSQL" does NOT create a calendar event

> If any check fails, see the **Troubleshooting** section below.

---

## Troubleshooting

**"Reminder detected but no calendar configured":**

- Verify the environment variables are set: `supabase secrets list`
- For O365: ensure admin consent was granted for `Calendars.ReadWrite`
- For Google: ensure you shared the calendar with the service account email

**Event not appearing on O365 calendar:**

- Check that `CALENDAR_USER_EMAIL` matches an actual mailbox in your tenant
- Verify the app has `Calendars.ReadWrite` **application** permission (not delegated)
- Check Edge Function logs for HTTP status codes

**Event not appearing on Google Calendar:**

- Verify the service account email has "Make changes to events" permission on the calendar
- Check that the Calendar API is enabled in your Google Cloud project
- The calendar ID might not be your email — check Calendar Settings → Integrate calendar

**Wrong timezone / date:**

- The AI defaults to Central time (-06:00) and resolves relative dates from the current server time
- Events are created in UTC — your calendar app should convert to your local timezone for display
