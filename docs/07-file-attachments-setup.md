# File Attachments Setup

Enable Cerebro to scan images, PDFs, and documents posted in Teams or Discord — extracting text and descriptions via AI vision. Optionally store files in Supabase Storage for later access.

## What You Get

- **AI Vision Analysis:** Images and PDFs are analyzed by gpt-4o-mini to extract text (OCR), descriptions, and key content
- **Document Scanning:** DOCX and text files are processed and their content added to your thought
- **Optional Storage:** Files can be saved to Supabase Storage (1 GB free tier) with signed URLs
- **Interactive UX:** After scanning, the bot asks if you want to keep or remove the stored file

## How It Works

1. You post a file (image, PDF, DOCX, TXT) in Teams or Discord
2. Cerebro downloads and analyzes the file using gpt-4o-mini vision
3. The extracted text/description becomes part of your captured thought
4. The file is automatically saved to Supabase Storage
5. The bot replies with a summary and a button to remove the file if you only wanted the scan

## Supported File Types

| Type | Extensions | Analysis Method |
|------|-----------|----------------|
| Images | PNG, JPG, JPEG, GIF, WebP | gpt-4o-mini vision (OCR + description) |
| PDFs | PDF | gpt-4o-mini vision (page analysis) |
| Word Docs | DOCX, DOC | Text extraction / description |
| Text Files | TXT, CSV | Direct text extraction |

## Prerequisites

- ✅ Core infrastructure deployed (Phase 1 complete)
- ✅ At least one capture source configured (Teams or Discord)
- ✅ Supabase project with Storage enabled (included in free tier)

## Setup Steps

### Step 1: Run the Schema Migration

In the Supabase SQL Editor, run the contents of `schemas/core/004-add-file-columns.sql`:

```sql
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS file_type TEXT;
```

### Step 2: Create the Storage Bucket

1. Go to your Supabase Dashboard → **Storage**
2. Click **New bucket**
3. Name: `cerebro-files`
4. Public: **OFF** (private bucket — files accessed via signed URLs)
5. File size limit: **50 MB** (or lower if preferred)
6. Click **Create bucket**

### Step 3: Configure Storage Policies

In the Supabase SQL Editor, run:

```sql
-- Allow the service role to manage files in cerebro-files bucket
CREATE POLICY "Service role full access" ON storage.objects
  FOR ALL USING (bucket_id = 'cerebro-files')
  WITH CHECK (bucket_id = 'cerebro-files');
```

Note: The Edge Functions use the `service_role` key which bypasses RLS, so this policy is a safety net for dashboard access.

### Step 4: Redeploy Edge Functions

Redeploy your capture Edge Functions to pick up the file handling code:

```bash
# Teams capture (if using Teams)
supabase functions deploy teams-capture --no-verify-jwt

# Discord capture (if using Discord)
supabase functions deploy discord-capture --no-verify-jwt
```

### Step 5: Update Discord Slash Command (Discord only)

If you're using Discord, update the `/capture` command to include the file option. Run this with your bot token:

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
        {
          "name": "thought",
          "description": "The thought to capture",
          "type": 3,
          "required": false
        },
        {
          "name": "file",
          "description": "Attach a file to scan and store",
          "type": 11,
          "required": false
        }
      ]
    },
    {
      "name": "search",
      "description": "Search your brain",
      "options": [
        {
          "name": "query",
          "description": "What to search for",
          "type": 3,
          "required": true
        }
      ]
    }
  ]'
```

Replace `YOUR_APP_ID` and `YOUR_BOT_TOKEN` with your Discord application values.

## 🚦 Verification

### Test 1: Image Scan (Teams or Discord)

1. Send/upload a photo or screenshot to the bot
2. **Expected:** Bot replies with AI-generated description of the image contents
3. **Expected:** The thought is captured with the file description in the content

### Test 2: PDF Scan

1. Send a PDF document to the bot
2. **Expected:** Bot analyzes the PDF and summarizes its contents
3. **Expected:** The extracted content is stored as a thought

### Test 3: File Storage

1. Send any supported file
2. **Expected:** Bot shows a summary with file analysis
3. **Expected (Teams):** Adaptive Card appears with "Remove file" button
4. **Expected (Discord):** Message appears with "🗑️ Remove file" button

### Test 4: Remove File

1. Click the "Remove file" button on a file capture message
2. **Expected:** Bot confirms file was removed from storage
3. **Expected:** The scanned text remains in your thought

### Test 5: MCP Search with Files

1. Use the MCP `list_thoughts` tool with `has_file: true`
2. **Expected:** Only thoughts with file attachments are returned
3. **Expected:** File icon (📎) indicator shows in results

## Storage Management

### Checking Storage Usage

Go to Supabase Dashboard → **Storage** → `cerebro-files` to see your files and usage.

### Free Tier Limits

- **1 GB** total storage
- **2 GB** bandwidth per month
- Signed URLs expire after 1 year (auto-generated on upload)

### Cleaning Up Old Files

To remove files no longer needed:

1. Go to Storage → `cerebro-files`
2. Browse the `teams/` or `discord/` folders
3. Select and delete files you no longer need

The associated thought content (scanned text) is preserved even after file deletion.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Storage upload error" | Check that `cerebro-files` bucket exists and is private |
| File not analyzed | Ensure file is under 20 MB and a supported type |
| Discord file option missing | Re-register slash commands (Step 5) |
| Teams buttons not working | Ensure bot has the `adaptiveCard/action` invoke permission |
| "File download failed" | Teams SharePoint files may need Graph API permissions |
| Vision API errors | Verify OpenRouter API key has credits remaining |

## Cost Estimate

| Component | Free Tier | Cost Beyond Free |
|-----------|-----------|-----------------|
| Supabase Storage | 1 GB | $0.021/GB per month |
| gpt-4o-mini Vision | ~$0.003/image | Per OpenRouter pricing |
| Bandwidth | 2 GB/month | $0.09/GB |

Typical usage (10-20 files/day): well within free tier for both storage and API costs.
