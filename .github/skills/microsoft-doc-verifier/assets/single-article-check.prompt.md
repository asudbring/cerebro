---
mode: agent
description: Fact-check the current article against official Microsoft documentation
tools:
  - microsoft-learn-mcp-server/microsoft_docs_search
  - microsoft-learn-mcp-server/microsoft_docs_fetch
  - microsoft-learn-mcp-server/microsoft_code_sample_search
  - read/readFile
  - read/problems
  - search/codebase
  - search/fileSearch
  - search/textSearch
  - edit/editFiles
  - todo
---

# Single Article Fact-Check

Fact-check the currently open article against official Microsoft documentation. Verify every technical claim, apply corrections in-place, and present a summary with source citations.

## Step 0 — Scope

Before starting, determine:
1. **Product area** — Read the file's `ms.service`, `ms.prod`, or content to identify the product area (Azure, M365, Security, Power Platform, Dynamics 365, Windows, DevTools).
2. **Service focus** — Identify the specific service or feature from the content.
3. **Depth** — Ask the user: "Quick check or thorough verification?"

Use the product area to select search domains (see SKILL.md → Product Area Search Domains).

## Step 1 — Identify claims

Read the current file and extract every verifiable technical claim:
- Product/service names and descriptions
- Feature capabilities, limitations, SKU/tier requirements
- Version numbers, API references, CLI/PowerShell commands
- Configuration values, defaults, quotas, limits
- Pricing, licensing, regional availability
- Preview/GA/deprecated status
- Code examples and syntax

For each claim, note the **WHAT** (assertion), **CONTEXT** (product/version), and **SCOPE** (applicability).

## Step 2 — Verify against sources

For each claim, search in priority order:
1. `microsoft_docs_search` — Search learn.microsoft.com for the topic using product-area-specific terms
2. `microsoft_docs_fetch` — Retrieve full pages when search snippets are insufficient
3. `microsoft_code_sample_search` — Validate code examples against official samples
4. `grep_search` / `semantic_search` — Cross-reference against workspace content
5. Check for deprecation, preview/GA status, and retirement notices

## Step 3 — Classify accuracy

For each claim, classify as:
- **✅ Accurate** — Matches current official documentation
- **⚠️ Partially accurate** — Mostly correct but needs refinement
- **❌ Inaccurate** — Contradicted by official sources
- **🕐 Outdated** — Was correct but no longer current
- **❓ Unverifiable** — No authoritative source found

## Step 4 — Apply corrections

For any inaccurate or outdated content:
- Edit the file directly with the corrected information
- Preserve the article's tone, style, and formatting
- Update `ms.date` in frontmatter to today's date
- Do NOT remove unverifiable claims — flag them instead

## Step 5 — Present results

Summarize in chat:
- Total claims checked
- Issues found (by severity)
- Per-issue details: what changed, why, source URL with tier
- Ask if the user wants to commit changes
