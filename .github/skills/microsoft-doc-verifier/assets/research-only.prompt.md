---
mode: agent
description: Research a Microsoft topic with citations and source tiers — no file editing
tools:
  - microsoft-learn-mcp-server/microsoft_docs_search
  - microsoft-learn-mcp-server/microsoft_docs_fetch
  - microsoft-learn-mcp-server/microsoft_code_sample_search
  - read/readFile
  - search/codebase
  - search/fileSearch
  - search/textSearch
  - edit/createFile
  - todo
---

# Research Only

Investigate a Microsoft documentation topic using official sources and produce a research report with inline citations, tiered sources, and evidence-based conclusions. Does NOT edit existing files.

## Step 0 — Scope

Ask the user (skip if already clear):
1. **Topic** — What do you want to research?
2. **Product area** — Which Microsoft product area? (Azure, M365, Security, Power Platform, Dynamics 365, Windows, DevTools)
3. **Specific questions** — Any particular claims or facts you want verified?
4. **Output format** — Chat only, file only, or both?

## Step 1 — Broad search

Search across official sources:
1. `microsoft_docs_search` — Multiple queries targeting different angles of the topic
2. Use product-area-specific search paths from SKILL.md → Product Area Search Domains
3. Note all potentially relevant pages with URLs and tiers

## Step 2 — Deep retrieval

For the most relevant sources:
1. `microsoft_docs_fetch` — Retrieve full page content
2. `microsoft_code_sample_search` — Find official code samples if applicable
3. Extract key facts with their exact source locations
4. Note publication dates and last-updated dates

## Step 3 — Cross-reference and verify

1. Cross-reference facts across multiple sources
2. Identify any contradictions between sources (resolve by tier)
3. Check for preview/GA/deprecated status
4. Note version-specific applicability

## Step 4 — Classify findings

For each researched fact:
- **Verified** — Confirmed by Tier 1 or Tier 2 source
- **Partially verified** — Confirmed with caveats or incomplete coverage
- **Unverifiable** — No authoritative source found
- **Conflicting** — Sources disagree (note which sources and tiers)

## Step 5 — Deliver output

### Chat format
Present findings with inline citations:
- Answer summary (2-3 paragraphs)
- Key facts with `[Source](URL) (Tier N)` citations
- Important caveats or limitations
- Sources table

### File format (if requested)
Create `research_[topic]_YYYYMMDD.md`:

```markdown
# Research Report: [Topic]

**Date**: YYYY-MM-DD
**Product area**: [area]
**Researcher**: GitHub Copilot

## Summary
[Overview of findings]

## Detailed findings

### [Sub-topic 1]
[Findings with inline citations]

### [Sub-topic 2]
[Findings with inline citations]

## Key facts

| Fact | Status | Source | Tier |
|------|--------|--------|------|

## Important caveats
- [Limitations, version dependencies, preview status]

## Sources consulted

### Tier 1 — Primary
- [Title](URL)

### Tier 2 — Secondary
- [Title](URL)
```
