---
mode: agent
description: Fact-check the current article against official Microsoft documentation
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

# Complete Fact-Check

Fact-check the currently open article against official Microsoft documentation. Verify every technical claim, provide evidence-based corrections, and generate a standalone report.

## Authority Hierarchy

Use sources in this priority order:
1. **Tier 1 (Primary)**: learn.microsoft.com, azure.microsoft.com
2. **Tier 2 (Secondary)**: techcommunity.microsoft.com, devblogs.microsoft.com, github.com/microsoft
3. **Tier 3 (Cross-reference only)**: Stack Overflow, community blogs

## Steps

### 1. Identify Claims
Read the current file and extract every technical claim:
- Product/service names and descriptions
- Feature capabilities, limitations, and prerequisites
- Version numbers, API references, CLI commands
- Configuration values, default settings, quotas
- Code examples and syntax

For each claim, note the **WHAT** (assertion), **CONTEXT** (product/version), and **SCOPE** (applicability).

### 2. Verify Against Official Sources
For each claim:
- Search `microsoft_docs_search` for the topic on learn.microsoft.com
- Use `microsoft_docs_fetch` to retrieve full documentation pages
- Use `microsoft_code_sample_search` for code examples
- Search the workspace with `semantic_search` and `grep_search` for related content
- Check for deprecation notices or recent changes
- Validate code examples using `get_errors`
- Test executable examples using `run_in_terminal` when possible

### 3. Assess Accuracy
For each verified claim, classify as:
- **Accurate**: Matches current official documentation
- **Partially Accurate**: Mostly correct but needs refinement
- **Inaccurate**: Contradicted by official sources
- **Outdated**: Was correct but no longer current

### 4. Make Corrections
For any inaccurate or outdated content:
- Edit the file directly with the corrected information
- Preserve the article's tone and style
- Update `ms.date` to today's date

### 5. Generate Report
Create a fact-check report file named `factcheck_[articlename]_YYYYMMDD.md` containing:

```markdown
# Fact-Check Report
**Date**: [today]
**Article**: [file path]
**Issues Found**: [count]
**Critical Issues**: [count]

## Executive Summary
[Overview of findings]

## Results

### Issue #N: [description]
- **Location**: [file, line number, section]
- **Original**: "[exact text]"
- **Corrected**: "[replacement text]"
- **Severity**: [Critical/High/Medium/Low]
- **Type**: [Inaccurate/Outdated/Incomplete/Deprecated]
- **Source**: [learn.microsoft.com URL]
- **Status**: [Corrected/Pending]

## Summary Table
| # | File | Line | Severity | Status |
|---|------|------|----------|--------|

## Sources Used
[All URLs with access dates]
```

### 6. Present Results
Summarize corrections made and ask if the user wants to commit changes.

## Quality Checklist
Before finishing, confirm:
- [ ] All technical claims verified against Tier 1 sources
- [ ] Every correction includes a learn.microsoft.com citation
- [ ] Code examples validated
- [ ] Version/deprecation status confirmed
- [ ] Report generated and saved
- [ ] ms.date updated
