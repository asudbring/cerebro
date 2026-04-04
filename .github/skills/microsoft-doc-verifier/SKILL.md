---
name: microsoft-doc-verifier
description: >-
  Verify technical accuracy of Microsoft documentation across all product areas
  (Azure, M365, Security, Power Platform, Dynamics 365, Windows, DevTools, and more).
  Supports single articles, folders, and PR file sets. Generates structured
  fact-check reports with per-file findings, source citations, and fix recommendations.
  Asks clarifying questions to scope verification to the correct product area.
argument-hint: "Describe what to verify — e.g., 'fact-check these M365 security articles', 'verify this PR', 'check this folder of Defender docs'"
user-invocable: true
---

# Microsoft Documentation Verifier

Verify technical accuracy of Microsoft documentation across **any product area** — Azure, Microsoft 365, Microsoft Security, Power Platform, Dynamics 365, Windows, Developer Tools, and more.

## Choose your workflow

| # | Workflow | When to use | Output |
|---|---------|-------------|--------|
| 1 | **Single Article Check** | Verify one article, corrections in-place | Edits + chat summary |
| 2 | **Batch Report** | Verify multiple files, generate a standalone report | `factcheck_*.md` report |
| 3 | **PR Review** | Fact-check all changed files in a GitHub PR | `factcheck_PR{number}.md` report |
| 4 | **Research Only** | Investigate a topic with citations, no edits | Research report |

### Decision guide

- **"Fact-check this article"** → Workflow 1
- **"Fact-check these files / this folder"** → Workflow 2
- **"Fact-check PR #12345"** → Workflow 3
- **"Research topic X with sources"** → Workflow 4

## Step 0 — Scope the verification (REQUIRED)

Before verifying any content, **ask the user these questions** to properly scope the work. Skip any that are already obvious from context.

### Questions to ask

1. **Product area**: "What Microsoft product area do these docs cover?" (Azure, M365, Security, Power Platform, Dynamics 365, Windows, DevTools, Other)
2. **Service/feature focus**: "Which specific service or feature? (e.g., Microsoft Defender for Endpoint, Azure Firewall, Intune, Power Automate)"
3. **Scope**: "Should I check a single file, a folder, or a PR?"
4. **Output preference**: "Do you want corrections applied to the files, a standalone report, or both?"
5. **Depth**: "Quick check or thorough verification?"

Use the answers to:
- Select the right search domains (see Product Area Search Domains below)
- Refine search queries with product-specific terminology
- Set the right source priority for the product area
- Choose the appropriate report template

> **If the user provides enough context upfront** (e.g., "fact-check PR #313172 covering Azure networking ZTA docs"), skip redundant questions and proceed.

## Source authority hierarchy

All workflows use a tiered system. Always prefer the highest available tier.

### Tier 1 — Primary official documentation

| Domain | Content type |
|--------|-------------|
| `learn.microsoft.com` | Product docs, tutorials, API reference, architecture guides |
| `azure.microsoft.com` | Azure service pages, pricing, SLAs |
| `microsoft.com/security` | Security product pages |
| `microsoft.com/microsoft-365` | M365 product pages |

### Tier 2 — Secondary official sources

| Domain | Content type |
|--------|-------------|
| `techcommunity.microsoft.com` | Feature announcements, deep dives |
| `devblogs.microsoft.com` | Engineering blogs, release notes |
| `github.com/microsoft/*` | SDK source, REST API specs, samples |
| `github.com/MicrosoftDocs/*` | Doc source, include files |
| `github.com/Azure/*` | Azure REST specs, SDK, CLI source |

### Tier 3 — Tertiary official sources

| Domain | Content type |
|--------|-------------|
| `developer.microsoft.com` | Graph API, platform SDKs |
| `code.visualstudio.com` | VS Code docs |
| `powershell.org` | PowerShell community (Microsoft-authored only) |

### Tier 4 — Community (verified Microsoft only)

| Source | Requirement |
|--------|------------|
| Microsoft Q&A | Responses from Microsoft employee badge holders |
| Stack Overflow | Answers from verified Microsoft employees only |

> **Rule**: Higher tier always wins. Cite the highest tier source available.

## Product area search domains

Use these to refine search queries based on the scoped product area.

| Product area | Primary search paths | Key terms |
|-------------|---------------------|-----------|
| **Azure** | `/azure/`, `/azure/architecture/` | Azure, resource, subscription, ARM, Bicep |
| **Microsoft 365** | `/microsoft-365/`, `/office/` | M365, Exchange, SharePoint, Teams, OneDrive |
| **Microsoft Security** | `/security/`, `/microsoft-365/security/`, `/defender/` | Defender, Sentinel, Entra, Purview, Intune |
| **Power Platform** | `/power-platform/`, `/power-apps/`, `/power-automate/`, `/power-bi/` | Power Apps, Power Automate, Dataverse, connectors |
| **Dynamics 365** | `/dynamics365/` | D365, Business Central, Finance, Supply Chain |
| **Windows** | `/windows/`, `/windows-server/` | Windows 11, Windows Server, Group Policy, registry |
| **Developer Tools** | `/visualstudio/`, `/dotnet/`, `/aspnet/` | Visual Studio, .NET, C#, SDK, NuGet |
| **GitHub / DevOps** | `/azure/devops/`, `/github/` | Pipelines, repos, actions, boards |

## Core verification steps

All workflows follow this pattern:

### Step 1 — Identify claims
Extract every verifiable technical claim:
- Product/service names and descriptions
- Feature capabilities, limitations, SKU requirements
- Version numbers, API references, CLI/PowerShell commands
- Configuration values, defaults, quotas, limits
- Pricing, licensing, regional availability
- Preview/GA/deprecated status
- Code examples and syntax

### Step 2 — Verify against sources
For each claim:
- Search `microsoft_docs_search` using product-area-specific terms
- Use `microsoft_docs_fetch` to retrieve full pages (don't rely on snippets)
- Cross-reference against workspace content using `grep_search` and `semantic_search`
- Check for deprecation, preview status, or retirement notices
- Validate code examples against official samples

### Step 3 — Classify accuracy

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ Accurate | Matches official docs | No change needed |
| ⚠️ Partially accurate | Minor discrepancy or missing context | Flag with recommendation |
| ❌ Inaccurate | Contradicts official source | Flag with correction + source |
| 🕐 Outdated | Was correct but superseded | Flag with current info + source |
| ❓ Unverifiable | No authoritative source found | Flag — do not remove |

### Step 4 — Generate output
- **Single article**: Edit file directly + chat summary with sources
- **Batch/PR report**: Generate `factcheck_*.md` with per-file tables

## Report template

For Workflow 2 (Batch) and Workflow 3 (PR), generate a report with this structure:

```markdown
# Fact-Check Report: [Title]

**Date**: YYYY-MM-DD
**Scope**: [PR #N / folder path / file list]
**Product area**: [Azure / M365 / Security / etc.]
**Files reviewed**: [count]

---

## Executive summary

[Overview: total files, issues found, critical items, overall assessment]

### Findings at a glance

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Accurate | N | Claims match official documentation |
| ⚠️ Partially accurate | N | Minor discrepancy or missing context |
| ❌ Inaccurate | N | Contradicts official sources |
| 🔗 Broken/suspect link | N | Links that may not resolve |

---

## Critical findings (action required)

### 1. [Severity icon] [File] — [Brief description]
**Claim**: "[quoted text]"
**Evidence**: [What the official docs say + source URL]
**Fix**: [Recommended correction]

---

## Advisory findings (recommended but not blocking)

### N. [Description]
[Details + recommendation]

---

## Per-file verification results

### [Service/Feature Area] (N files)

| File | Title | Status | Notes |
|------|-------|--------|-------|
| file.md | Description | ✅/⚠️/❌ | Details |

---

## Link audit

| Link | Status |
|------|--------|
| `/path/to/doc` | ✅ Valid / 🔗 Suspect |

---

## Sources consulted

### Tier 1 — Primary
- [Title](URL)

### Tier 2 — Secondary
- [Title](URL)
```

## Quality checklist

Before completing any workflow:

- [ ] Scope confirmed with user (product area, service, depth)
- [ ] Every factual claim verified against at least one fetched source
- [ ] Highest-tier source used for each claim
- [ ] All cited URLs are from allowed Microsoft domains
- [ ] Preview/GA/deprecated status checked for mentioned services
- [ ] SKU/tier requirements noted where relevant
- [ ] Code examples validated
- [ ] Remediation/reference links spot-checked
- [ ] Unverifiable claims flagged, not removed
- [ ] Report generated (for batch/PR workflows)

## Prompt assets

| File | Workflow |
|------|----------|
| `assets/single-article-check.prompt.md` | Single Article Check |
| `assets/batch-report.prompt.md` | Batch Report |
| `assets/pr-review.prompt.md` | PR Review |
| `assets/research-only.prompt.md` | Research Only |

## Sharing this skill

To share with a colleague:

1. Copy the `microsoft-doc-verifier/` folder to their `~/.copilot/skills/` directory
   - Windows: `%USERPROFILE%\.copilot\skills\microsoft-doc-verifier\`
   - macOS/Linux: `~/.copilot/skills/microsoft-doc-verifier/`
2. Ensure they have:
   - VS Code with GitHub Copilot (agent mode)
   - Microsoft Learn MCP Server connected
   - GitHub MCP Server connected (for PR workflows)
3. Restart VS Code
4. Invoke via: "fact-check these articles" or "verify this PR"
