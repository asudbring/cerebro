# Fact-Checker Workflows — Detailed Reference

Detailed procedures, outputs, and comparison for all seven fact-checker workflows.

## Workflow 1: Quick In-Place Fact-Check

**Prompt**: `fact-check-and-edit.prompt.md`
**Mode**: Agent

### When to Use
- Fast verification of a single article
- You want corrections applied directly, no separate report file
- Article uses `[!INCLUDE ...]` references that should also be checked

### Key Features
- Resolves and fact-checks `[!INCLUDE ...]` files; edits include files directly if they contain errors
- Uses a 4-tier PUBLIC source hierarchy (Tier 3 = Code & Specs, Tier 4 = Cross-reference)
- All source references presented in chat, not written to the file

### Procedure
1. Read the file and resolve all INCLUDE references
2. Identify every verifiable technical claim
3. Verify each claim against tiered sources
4. Edit the file directly with corrections; update `ms.date`
5. Present all references and changes in chat

### Output
- Edited file with corrections applied
- Chat summary listing: what changed, why, source URL and tier

---

## Workflow 2: Full Standalone Report

**Prompt**: `complete-fact-check.prompt.md`
**Mode**: Agent

### When to Use
- Formal audit requiring a saved report artifact
- Need to share findings with reviewers or stakeholders
- Want a permanent record of verification

### Procedure
1. Identify all verifiable claims
2. Verify against official sources (3-tier hierarchy)
3. Assess accuracy: Accurate / Partially Accurate / Inaccurate / Outdated
4. Make corrections in the file; update `ms.date`
5. Generate report: `factcheck_[articlename]_YYYYMMDD.md`

### Report Structure
```
# Fact-Check Report: [Article Title]
- **Date**: YYYY-MM-DD
- **Article**: [path]
- **Checked by**: GitHub Copilot

## Executive Summary
[overview of findings]

## Detailed Findings
### Issue 1: [title]
- **Location**: Line N
- **Original**: [text]
- **Status**: Inaccurate / Outdated / etc.
- **Correction**: [updated text]
- **Source**: [URL] (Tier N)

## Summary Table
| # | Claim | Status | Source |
|---|-------|--------|--------|

## Sources Used
| # | Title | URL | Tier |
|---|-------|-----|------|
```

---

## Workflow 3: Internal + Public Sources

**Prompt**: `complete-fact-checker-internal.prompt.md`
**Mode**: Agent

### When to Use
- Need to cross-reference internal Microsoft resources
- Verifying claims that may only be confirmable via internal docs
- Want to separate public-safe corrections from internal-only findings

### Key Features
- 6-tier hierarchy: Tiers 1–3 public + Tier 4 Internal Docs + Tier 5 Internal Code + Tier 6 Internal Metadata
- Adds "Unverifiable (Public)" classification for claims only verifiable internally
- Public corrections applied to file; internal findings flagged for author review
- Report has two sections: Public Findings + ⛔ Internal Findings (Microsoft Confidential)

### Procedure
1. Identify all verifiable claims
2. Verify against public sources (Tiers 1–3)
3. Verify against internal sources (Tiers 4–6)
4. Assess accuracy (including "Unverifiable (Public)" category)
5. Apply public corrections to file
6. Generate report with Public and Internal sections
7. Present three options: commit public corrections, review internal suggestions, strip internal section

### Output
- Edited file (public corrections only)
- Report with clearly separated public and confidential sections

---

## Workflow 4: Freshness + Fact Review

**Prompt**: `complete-freshness-review.prompt.md`
**Mode**: Agent

### When to Use
- Article may be stale — need both freshness and accuracy check
- Combined review in a single pass saves time
- Focus on dates, versions, deprecated features, broken patterns

### Freshness Checks (in addition to fact-checking)
- `ms.date` staleness
- Deprecated or retired services/features
- Outdated version numbers
- Broken or redirected links
- Metadata completeness
- Style and formatting issues

### Procedure
1. Analyze freshness issues (dates, versions, deprecations, links, metadata, style)
2. Fact-check all technical claims
3. Edit file directly with all corrections; update `ms.date`
4. Present per-edit summary: Line, What changed, Why, Type (freshness/accuracy), Source
5. Offer to save: create branch, commit, push, open PR

### Output
- Edited file with freshness and accuracy fixes
- Chat summary with change details
- Optional: branch + PR workflow

---

## Workflow 5: Deep Agent-Driven Check

**Prompt**: `microsoft-fact-checker.agent.md`
**Mode**: Agent (with extensive tool usage)

### When to Use
- Need the most thorough verification possible
- Article covers complex or critical technical content
- Want per-fact evidence documentation

### Key Features
- Uses extensive tool calls for verification
- 3-tier authority hierarchy
- Per-fact output format: WHAT CHANGED, WHY THIS MATTERS, EVIDENCE
- Structured error handling and completion criteria

### Procedure
1. Claim Identification — extract all verifiable claims
2. Primary Source Verification — search and fetch Tier 1 sources
3. Cross-Reference — validate against Tier 2 and 3 sources
4. Technical Accuracy Assessment — classify each claim
5. Recommendation Output — per-fact structured findings

### Per-Fact Output Format
```
**WHAT CHANGED**: [specific claim and correction]
**WHY THIS MATTERS**: [impact of the error]
**EVIDENCE**: [source URL] (Tier N)
```

---

## Workflow 6: Research Only

**Prompt**: `microsoft-researcher.prompt.md`
**Mode**: Agent

### When to Use
- Need to investigate a topic, not edit a file
- Want a research report with citations and source tiers
- Need to answer a technical question with evidence

### Key Features
- 7-tier hierarchy (4 public + 3 internal)
- Output options: chat only, file only, or both
- Does NOT edit existing files unless explicitly asked
- Claims classified: Verified, Partially Verified, Internally Verified, Unverifiable

### Procedure
1. Understand the research question
2. Search broadly across public sources
3. Go deep — fetch full pages for key sources
4. Consult internal sources (if applicable)
5. Cross-reference and verify
6. Validate code examples against official samples
7. Deliver output in requested format

### Output Format
- Research report with: Answer Summary, Details (with inline citations), Code Examples, Important Caveats, Sources Table
- Optional ⛔ Internal Findings section
- File output naming: `research_[topic_slug]_YYYYMMDD.md`

---

## Workflow 7: Customer Incident Analysis (CIA)

**Prompt**: `CIA-Analysis.prompt.md`
**Mode**: Agent

### When to Use
- Need to analyze customer incident patterns for a service area
- Want to identify documentation opportunities from support trends
- Building a case for content investment

### Input
- Service Area (e.g., "Azure Networking") or Product/Feature (e.g., "Application Gateway")

### Report Structure (11 sections)
1. **Executive Summary** — scope, period, methodology
2. **Incident Distribution by Service** — table with counts and percentages
3. **Trends & Patterns** — temporal analysis, seasonal patterns
4. **Top Issue Categories** — 6–8 ranked categories with counts
5. **Service-Specific Pain Points** — per-service subsections
6. **Documentation & Content Opportunities** — Priority 1 (quick wins) and Priority 2 (strategic)
7. **Trending Issues** — emerging patterns in last 30/60/90 days
8. **Recommendations** — prioritized by quarter (Q1 immediate, Q2 medium-term, Q3+ long-term)
9. **Success Metrics** — table with metrics, current baseline, targets, measurement method
10. **Data Sources & Methodology** — sources used, analysis methods
11. **Conclusion & Action Items** — top 3 priorities

### Output
- Markdown file: `{ServiceArea-or-Product}-incident-analysis.md`
- Includes `[Insert image: ...]` placeholders for visualizations
- Professional tone for internal Microsoft reporting

---

## Workflow Comparison

| Feature | W1 Quick | W2 Report | W3 Internal | W4 Fresh | W5 Deep | W6 Research | W7 CIA |
|---------|----------|-----------|-------------|----------|---------|-------------|--------|
| Edits file | ✅ | ✅ | ✅ (public) | ✅ | ✅ | ❌ | ❌ |
| Report file | ❌ | ✅ | ✅ | ❌ | ❌ | Optional | ✅ |
| Internal sources | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Freshness check | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| INCLUDE resolution | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Per-fact evidence | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| PR workflow | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
