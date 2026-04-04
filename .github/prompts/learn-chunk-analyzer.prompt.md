---
mode: agent
description: Analyze how Microsoft Learn content chunks and surfaces for a search query or article URL. Returns a structured report with chunk inventory, relevance scoring, pattern findings, and recommendations.
tools:
  - microsoft-learn-mcp-server/microsoft_docs_search
  - microsoft-learn-mcp-server/microsoft_docs_fetch
  - microsoft-learn-mcp-server/microsoft_code_sample_search
  - edit/createFile
  - read/readFile
---

# Learn Chunk Analyzer

Analyze how Microsoft Learn content is chunked and surfaced by the Learn MCP server.

## Input

The user provides either:
- A **search query** — run `microsoft_docs_search` and analyze all returned chunks
- An **article URL** — run `microsoft_docs_fetch` and simulate how the page would be chunked by section

If the input is ambiguous, ask the user which one they mean before proceeding.

## What to produce

A structured **Chunk Analysis Report** with:

1. **Chunk inventory table** — every result listed with: article title, section heading, character count, detected deployment method (portal/CLI/PowerShell/ARM/Bicep/Terraform), and relevance rating

2. **Relevance ratings** for each chunk:
   - ✅ **Direct** — directly answers the query
   - ⚠️ **Partial** — related but incomplete or missing key steps
   - 🔀 **Tangential** — same topic area, different task or scenario
   - ❌ **Noise** — wrong method, post-task step, or unrelated service

3. **Signal summary** — check all 7 patterns and report which are present:
   - **A — Same-article duplication**: > 2 results from one article
   - **B — Procedure truncation**: chunk ends mid-procedure
   - **C — Method cross-contamination**: wrong deployment method in results
   - **D — Orphaned intro chunk**: intro-only chunk with < 600 chars
   - **E — Missing URLs**: blank `url` field on any result
   - **F — Post-task noise**: downstream steps returned for an earlier-task query
   - **G — Oversized sections** (URL only): sections > 2,500 chars likely to be split

4. **Key observations** — 3–5 prose findings with specific evidence

5. **Recommendations** split into two audiences:
   - **For article authors** — structural changes to the markdown (H2 naming, section grouping, procedure completeness)
   - **For pipeline / platform** — MCP server, chunk size config, metadata tagging, deduplication

6. **Signal-to-noise ratio**: `(Direct + Partial) / Total × 100` — rate as Good (≥70%), Moderate (50–69%), or Poor (<50%)

## Report format

```markdown
# Chunk Analysis Report

**Date**: YYYY-MM-DD
**Input type**: Search query / Article URL
**Query / URL**: [value]
**Results returned**: N chunks from N unique articles
**Signal ratio**: N% ([rating])

---

## Chunk inventory

| # | Article | Section heading | Chars | Method | Relevance |
|---|---------|-----------------|-------|--------|-----------|

---

## Signal summary

| Pattern | Detected | Detail |
|---------|----------|--------|
| A — Same-article duplication | ✅/❌ | |
| B — Procedure truncation | ✅/❌ | |
| C — Method cross-contamination | ✅/❌ | |
| D — Orphaned intro chunk | ✅/❌ | |
| E — Missing URLs | ✅/❌ | |
| F — Post-task noise | ✅/❌ | |
| G — Oversized sections | ✅/❌ | |

---

## Key observations

### 1. [Title]
[Detail with specific chunk evidence]

---

## Recommendations

### For article authors
**1.** [Recommendation]

### For pipeline / platform
**1.** [Recommendation]

---

## Most relevant chunks
[Top 2–3 chunks that best answer the query]

## Least relevant chunks
[Chunks that should not have been returned and why]
```

## Output options

- Default: present the full report in chat
- If user says "save the report" or "write to file": save as `chunk-analysis_[slug]_YYYYMMDD.md` in the workspace root using `createFile`

## Rules

- DO analyze every returned chunk — don't skip any
- DO check all 7 patterns (A–G) and report each explicitly
- DO provide at least 3 specific, actionable recommendations
- DO use `microsoft_docs_fetch` to get full content for any truncated chunk before assessing truncation
- DO note character counts for all chunks
- DO calculate and report the signal-to-noise ratio
- DO NOT skip the pattern checklist — all 7 must appear in the report even if not detected
