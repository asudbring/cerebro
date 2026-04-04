---
mode: agent
description: Fact-check the current article using both public and internal Microsoft resources
tools:
  - microsoft-learn-mcp-server/microsoft_docs_search
  - microsoft-learn-mcp-server/microsoft_docs_fetch
  - microsoft-learn-mcp-server/microsoft_code_sample_search
  - web/fetch
  - web/githubRepo
  - read/readFile
  - read/problems
  - search/codebase
  - search/fileSearch
  - search/textSearch
  - search/usages
  - edit/editFiles
  - edit/createFile
  - execute/runInTerminal
  - execute/getTerminalOutput
  - todo
---

# Complete Fact-Check (Internal)

Fact-check the currently open article against **both public and internal** Microsoft resources. Verify every technical claim, provide evidence-based corrections, and generate a standalone report. Internal-sourced findings are isolated in a dedicated confidential section of the report to prevent accidental public disclosure.

## Authority Hierarchy

Use sources in this priority order:

### Public Sources

1. **Tier 1 (Primary)**: learn.microsoft.com, azure.microsoft.com — canonical product docs for names, features, configurations, limits, and guidance.
2. **Tier 2 (Secondary)**: techcommunity.microsoft.com, devblogs.microsoft.com, github.com/microsoft — feature announcements, best practices, REST API specs (Azure/azure-rest-api-specs), SDK/CLI source code.
3. **Tier 3 (Cross-reference only)**: Microsoft Q&A, Stack Overflow, community blogs — edge-case clarifications, community-sourced solutions.

### Internal Sources (Microsoft Confidential)

4. **Tier 4 (Internal Documentation)**: SharePoint sites, internal wikis, engineering documentation portals — design specifications, architectural details, unreleased feature information, internal best practices.
5. **Tier 5 (Internal Code & Config)**: Product source code repositories, internal configuration files — actual implementation details such as default values, flags, error messages, supported API versions.
6. **Tier 6 (Internal Metadata)**: Product catalogs and metadata services (e.g., Service Tree / Eco Manager) — authoritative data on official service names, SKU identifiers, version numbers, feature flags, regional availability, and service limits.

> **Rule**: Internal sources (Tiers 4–6) must **never** be cited in public-facing documentation. They are used only to validate accuracy. Any finding derived solely from an internal source must appear in the **Internal Findings (Confidential)** section of the report and must not be applied to the article without explicit author approval.

## Steps

### 1. Identify Claims

Read the current file and extract every technical claim:

- Product/service names and descriptions
- Feature capabilities, limitations, and prerequisites
- Version numbers, API references, CLI/PowerShell commands
- Configuration values, default settings, quotas and limits
- Code examples and syntax
- Pricing tiers, SKUs, and regional availability
- Deprecation or preview/GA status

For each claim, note the **WHAT** (assertion), **CONTEXT** (product/version), and **SCOPE** (applicability).

### 2. Verify Against Public Sources

For each claim:

- Search `microsoft_docs_search` for the topic on learn.microsoft.com
- Use `microsoft_docs_fetch` to retrieve full documentation pages
- Use `microsoft_code_sample_search` for code examples
- Search the workspace with `semantic_search` and `grep_search` for related content
- Use `web/githubRepo` to check Azure REST API specs (Azure/azure-rest-api-specs), Azure SDK repos, Azure PowerShell, and Azure CLI repositories for parameter names, defaults, and supported values
- Use `web/fetch` to check TechCommunity and DevBlogs for recent announcements or changes
- Check for deprecation notices or recent changes
- Validate code examples using `get_errors`
- Test executable examples using `run_in_terminal` when possible

### 3. Verify Against Internal Sources

For claims that cannot be fully verified via public sources, or to catch discrepancies between public docs and actual implementation:

- **Internal documentation portals & wikis**: Search internal SharePoint sites, engineering wikis, and design docs for deeper context on feature behavior, architecture, or unreleased changes that may affect accuracy.
- **Internal codebases & configuration files**: Query product source code to confirm default values, flag names, error messages, and supported parameters. Documentation may lag behind code changes — the code is the ground truth (e.g., PowerShell/CLI documentation is generated from code comments in Azure/azure-powershell).
- **Internal product metadata & catalogs**: Check internal product catalogs or metadata services for authoritative data on service names, SKU identifiers, API versions, limits, and regional availability.

> **Important**: Tag every finding from internal sources with `[INTERNAL]` and record the internal source reference. These findings must be routed to the confidential section of the report.

### 4. Assess Accuracy

For each verified claim, classify as:

- **Accurate**: Matches current official documentation and internal implementation
- **Partially Accurate**: Mostly correct but needs refinement
- **Inaccurate**: Contradicted by official sources or internal implementation
- **Outdated**: Was correct but no longer current
- **Unverifiable (Public)**: Cannot be confirmed with public sources alone — flagged for internal review

### 5. Make Corrections

For any inaccurate or outdated content **confirmed by public sources**:

- Edit the file directly with the corrected information
- Preserve the article's tone and style
- Update `ms.date` to today's date
- Cite only public sources in the article

For issues found **only through internal sources**:

- **Do NOT** edit the article automatically
- Record the suggested correction in the Internal Findings section of the report
- Flag for author review and approval before any changes are made

### 6. Generate Report

Create a fact-check report file named `factcheck_[articlename]_YYYYMMDD.md` containing:

````markdown
# Fact-Check Report

**Date**: [today]
**Article**: [file path]
**Scope**: Public + Internal verification
**Public Issues Found**: [count]
**Internal Issues Found**: [count]
**Critical Issues**: [count]

## Executive Summary

[Overview of findings, including a note on how many issues were identified through internal-only sources]

---

## Public Findings

Issues verified and correctable using publicly available sources.

### Issue #N: [description]

- **Location**: [file, line number, section]
- **Original**: "[exact text]"
- **Corrected**: "[replacement text]"
- **Severity**: [Critical/High/Medium/Low]
- **Type**: [Inaccurate/Outdated/Incomplete/Deprecated]
- **Source**: [learn.microsoft.com or other public URL]
- **Source Tier**: [Tier 1/Tier 2/Tier 3]
- **Status**: [Corrected/Pending]

### Public Summary Table

| # | File | Line | Severity | Type | Source Tier | Status |
|---|------|------|----------|------|-------------|--------|

---

## ⛔ Internal Findings (Microsoft Confidential)

> **WARNING**: This section contains information derived from internal Microsoft resources. Do NOT include this section in any public-facing document, pull request description, or external communication. Remove this section before sharing the report externally.

Issues identified or validated through internal-only sources (Tiers 4–6). These require author review before corrections are applied.

### Internal Issue #N: [description]

- **Location**: [file, line number, section]
- **Original**: "[exact text]"
- **Suggested Correction**: "[proposed replacement text]"
- **Severity**: [Critical/High/Medium/Low]
- **Type**: [Inaccurate/Outdated/Incomplete/Deprecated/Unverifiable Publicly]
- **Internal Source**: [description of internal source — e.g., "Product source code", "Internal wiki", "Service Tree metadata"]
- **Rationale**: [Why the internal source contradicts or supplements the current text]
- **Public Source Available**: [Yes/No — if Yes, list the public source that could be cited instead]
- **Status**: Pending Author Review

### Internal Summary Table

| # | File | Line | Severity | Internal Source Type | Public Source Available | Status |
|---|------|------|----------|---------------------|----------------------|--------|

---

## Sources Used

### Public Sources

[All public URLs with access dates]

### Internal Sources

[Description of internal sources consulted — do NOT include direct links to internal systems in any externally shared version of this report]
````

### 7. Present Results

Summarize:

- Number of corrections made (from public sources)
- Number of internal findings pending author review
- Any claims that could not be verified by any source

Ask if the user wants to:
1. Commit the public-source corrections
2. Review and approve internal-source suggestions one by one
3. Strip the internal section and produce a public-safe version of the report

## Quality Checklist

Before finishing, confirm:

- [ ] All technical claims verified against Tier 1 public sources
- [ ] Internal sources consulted for claims not fully verifiable publicly
- [ ] Every public correction includes a learn.microsoft.com or public citation
- [ ] Internal findings are isolated in the confidential report section
- [ ] No internal source links or confidential details appear outside the Internal Findings section
- [ ] Code examples validated
- [ ] Version/deprecation status confirmed
- [ ] Report generated and saved
- [ ] ms.date updated (for public-source corrections only)
- [ ] Author notified of pending internal-source suggestions

## Source Reference

| Source | Access | Best for Validating |
|--------|--------|---------------------|
| Microsoft Learn & Azure websites | Public | Product names, features, configurations, limits, guidance |
| TechCommunity & DevBlogs | Public | Feature announcements, updates, best practices from product teams |
| Microsoft Q&A | Public | Clarifications, edge cases, engineer-answered Q&A |
| Stack Overflow & community forums | Public | Community solutions, usage examples, undocumented behaviors |
| GitHub repos (REST specs, SDKs, CLI) | Public | API schemas, parameters, defaults, code examples |
| Internal documentation (SharePoint, wikis) | Internal | Design specs, feature internals, unreleased details |
| Internal codebases & config files | Internal | Default values, flags, error messages, implementation truth |
| Internal product metadata & catalogs | Internal | Service names, SKUs, API versions, limits, availability |
