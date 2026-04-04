---
name: fact-checker
description: >-
  Verify technical accuracy of Azure documentation using official Microsoft sources.
  Offers seven workflows: quick in-place fact-check, full standalone report,
  internal-source verification, freshness review, deep agent-driven check,
  research-only investigation, and customer incident analysis. All workflows use
  a tiered source authority hierarchy prioritizing learn.microsoft.com.
argument-hint: "Describe what to verify — e.g., 'fact-check this article', 'freshness review', 'research Azure Front Door caching', 'CIA analysis for App Service'"
user-invocable: true
---

# Fact-Checker Skill

Verify and validate technical claims in Azure documentation against official Microsoft sources, using a structured authority hierarchy and reproducible workflows.

## Choose Your Workflow

| # | Workflow | When to Use | Output | Prompt Asset |
|---|---------|-------------|--------|--------------|
| 1 | **Quick In-Place Fact-Check** | Fast verification; edit the file directly, no report file | Edits in file + references in chat | [`fact-check-and-edit.prompt.md`](../../prompts/fact-check-and-edit.prompt.md) |
| 2 | **Full Standalone Report** | Comprehensive audit with a saved report artifact | Edits in file + `factcheck_*.md` report | [`complete-fact-check.prompt.md`](../../prompts/complete-fact-check.prompt.md) |
| 3 | **Internal + Public Sources** | Need to cross-reference internal Microsoft resources (SharePoint, wikis, code) | Edits (public only) + report with confidential section | [`complete-fact-checker-internal.prompt.md`](../../prompts/complete-fact-checker-internal.prompt.md) |
| 4 | **Freshness + Fact Review** | Combined freshness analysis and fact-check in one pass | Direct edits + summary in chat | [`complete-freshness-review.prompt.md`](../../prompts/complete-freshness-review.prompt.md) |
| 5 | **Deep Agent-Driven Check** | Thorough verification using extensive tool calls | Per-fact WHAT/WHY/EVIDENCE output | [`microsoft-fact-checker.agent.md`](../../agents/microsoft-fact-checker.agent.md) |
| 6 | **Research Only** | Investigate a topic with citations; no file editing | Research report (chat, file, or both) | [`microsoft-researcher.prompt.md`](../../prompts/microsoft-researcher.prompt.md) |
| 7 | **Customer Incident Analysis** | Analyze customer incidents for a service area | `{service}-incident-analysis.md` report | [`CIA-Analysis.agent.md`](../../agents/CIA-Analysis.agent.md) |

### Decision Guide

- **"Just fix this article"** → Workflow 1 (Quick In-Place)
- **"Audit this article and give me a report"** → Workflow 2 (Full Report)
- **"Check against internal docs too"** → Workflow 3 (Internal + Public)
- **"Is this article still current?"** → Workflow 4 (Freshness + Fact)
- **"Do a deep verification of every claim"** → Workflow 5 (Deep Agent)
- **"Research topic X with sources"** → Workflow 6 (Research Only)
- **"Analyze customer incidents for Service Y"** → Workflow 7 (CIA Analysis)

## Source Authority Hierarchy

All workflows use a tiered system. Always prefer the highest available tier.

### Public Sources (all workflows)

| Tier | Source | Use For |
|------|--------|---------|
| **1 — Primary** | learn.microsoft.com, azure.microsoft.com | Product names, features, configs, limits, pricing, official guidance |
| **2 — Secondary** | techcommunity.microsoft.com, devblogs.microsoft.com, GitHub repos (REST specs, SDKs, CLI) | Announcements, updates, API schemas, code examples |
| **3 — Tertiary** | developer.microsoft.com, code.visualstudio.com | Platform docs, Graph API, VS Code |
| **4 — Community** | Microsoft Q&A (official responses), Stack Overflow (verified MS employees) | Clarifications, edge cases, engineer-answered Q&A |

### Internal Sources (Workflow 3 and 6 only)

| Tier | Source | Use For |
|------|--------|---------|
| **5** | Internal documentation (SharePoint, wikis) | Design specs, feature internals |
| **6** | Internal codebases & config files | Default values, flags, implementation truth |
| **7** | Internal product metadata & catalogs | Service names, SKUs, API versions, availability |

> **Rule**: Internal sources are never cited in public-facing documentation. Internal findings must be isolated in a clearly marked confidential section.

See [references/source-hierarchy.md](references/source-hierarchy.md) for the complete source reference table.

## Core Workflow Steps

All verification workflows follow this general pattern (specific workflows may add or modify steps):

### Step 1 — Identify Claims
- Extract every verifiable technical claim from the article
- Include: service names, feature availability, configuration values, CLI/API commands, pricing, limits, version numbers, dates, URLs
- Resolve `[!INCLUDE ...]` references and check included content too (Workflow 1 especially)

### Step 2 — Verify Against Sources
- Search official sources using the tiered hierarchy
- Fetch full pages (don't rely on search snippets alone)
- For each claim, record: source URL, tier, verification status, and evidence

### Step 3 — Assess Accuracy
Classify each claim:
- **Accurate** — Matches current official documentation
- **Partially Accurate** — Mostly correct but needs minor update
- **Inaccurate** — Contradicts official sources
- **Outdated** — Was correct but superseded by newer information
- **Unverifiable** — No authoritative source found (flag, don't remove)
- **Unverifiable (Public)** — Only verifiable via internal sources (Workflow 3)

### Step 4 — Apply Corrections
- Edit the file directly with corrections (Workflows 1–5)
- Update `ms.date` in frontmatter to today's date
- Never remove content that can't be verified — flag it instead
- Internal-source corrections: flag for author review, don't apply directly

### Step 5 — Report Results
- Present findings with per-item details: what changed, why, evidence source
- Generate report file if required by the workflow
- List all sources consulted

See [references/workflows.md](references/workflows.md) for detailed per-workflow procedures.

## Accuracy Classification Table

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ Accurate | Matches official docs | No change needed |
| ⚠️ Partially Accurate | Minor discrepancy | Edit with correction |
| ❌ Inaccurate | Contradicts official source | Edit with correction + cite source |
| 🕐 Outdated | Superseded by newer info | Update to current + cite source |
| ❓ Unverifiable | No authoritative source | Flag in report; do not remove |

## Quality Checklist

Before completing any workflow, confirm:

- [ ] Every factual claim verified against at least one fetched source
- [ ] Highest-tier source used for each claim (prefer Tier 1 over lower)
- [ ] All cited URLs are from allowed Microsoft domains
- [ ] Stack Overflow / community citations confirmed from official Microsoft accounts
- [ ] `ms.date` updated if any edits were made
- [ ] Code examples validated against official samples or REST API specs
- [ ] Deprecation and retirement status checked for mentioned services
- [ ] Version applicability noted where relevant
- [ ] Unverifiable claims flagged explicitly, not removed
- [ ] Internal findings isolated in confidential section (if applicable)

## Prompt Assets

The prompt and agent files for each workflow live in the repo-level directories:

| File | Location | Workflow |
|------|----------|----------|
| [`fact-check-and-edit.prompt.md`](../../prompts/fact-check-and-edit.prompt.md) | `prompts/` | Quick In-Place |
| [`complete-fact-check.prompt.md`](../../prompts/complete-fact-check.prompt.md) | `prompts/` | Full Report |
| [`complete-fact-checker-internal.prompt.md`](../../prompts/complete-fact-checker-internal.prompt.md) | `prompts/` | Internal + Public |
| [`complete-freshness-review.prompt.md`](../../prompts/complete-freshness-review.prompt.md) | `prompts/` | Freshness + Fact |
| [`microsoft-fact-checker.agent.md`](../../agents/microsoft-fact-checker.agent.md) | `agents/` | Deep Agent |
| [`microsoft-researcher.prompt.md`](../../prompts/microsoft-researcher.prompt.md) | `prompts/` | Research Only |
| [`CIA-Analysis.agent.md`](../../agents/CIA-Analysis.agent.md) | `agents/` | CIA Analysis |
