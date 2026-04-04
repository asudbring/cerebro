---
mode: agent
description: Perform a complete freshness review — update outdated content, fact-check against official Microsoft docs, fix links, and optionally commit + PR
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
  - execute/runInTerminal
  - execute/getTerminalOutput
  - todo
---

# Complete Freshness Review

Perform a full freshness review on the currently open article. This combines content freshness analysis with fact-checking against official Microsoft documentation, then makes all corrections directly in the file.

## Authority Hierarchy

Use sources in this priority order:
1. **Tier 1 (Primary)**: learn.microsoft.com, azure.microsoft.com
2. **Tier 2 (Secondary)**: techcommunity.microsoft.com, devblogs.microsoft.com, github.com/microsoft
3. **Tier 3 (Cross-reference only)**: Stack Overflow, community blogs

## Steps

### 1. Analyze the Article for Freshness Issues
Read the current file and scan for:
- **Outdated information**: dates, version numbers, deprecated features, retired services, old UI references, sunset announcements
- **Broken or suspect links**: check absolute URLs by fetching them; flag any that return errors or redirect to retired pages
- **ms.date**: note the current value — it will be updated to today's date after edits
- **Metadata**: verify `ms.service`, `ms.topic`, `ms.author`, and other YAML front-matter fields are still valid
- **Style**: flag obvious grammar, clarity, or formatting issues (passive voice, inconsistent headings, missing alt text)

### 2. Fact-Check Technical Claims
Extract every technical claim from the article and verify each one:
- Product/service names and descriptions
- Feature capabilities, limitations, and prerequisites
- Version numbers, API references, CLI commands
- Configuration values, default settings, quotas
- Code examples and syntax

For each claim:
- Search `microsoft_docs_search` for the topic on learn.microsoft.com
- Use `microsoft_docs_fetch` to retrieve full documentation pages when needed
- Use `microsoft_code_sample_search` for code examples
- Check for deprecation notices or recent changes
- Validate code examples using `get_errors`

Classify each claim as:
- **Accurate**: Matches current official documentation
- **Partially Accurate**: Mostly correct but needs refinement
- **Inaccurate**: Contradicted by official sources
- **Outdated**: Was correct but no longer current

### 3. Edit the File Directly
For any inaccurate, outdated, or incomplete content:
- Make corrections directly in the current file
- Preserve the article's existing tone, style, and formatting
- Update `ms.date` to today's date (MM/DD/YYYY format)
- Fix broken links with current URLs
- Update version numbers, CLI commands, and code samples to current versions
- Correct any deprecated feature references with current alternatives
- Fix grammar, clarity, and formatting issues found in Step 1
- Do NOT add HTML comments or reference markers into the article — keep it clean

### 4. Present a Summary in Chat
After ALL edits are complete, present a single summary with this format for each change:

---

**Edit N: [brief description]**
- **Line(s)**: [approximate line number(s)]
- **What changed**: [original text] → [new text]
- **Why**: [brief explanation]
- **Type**: [Outdated | Inaccurate | Broken Link | Style | Metadata]
- **Source(s)**:
  - [Title](learn.microsoft.com URL)
  - [Title](secondary URL if used)

---

End with:
- Total number of edits made
- Count by type (outdated, inaccurate, broken link, style, metadata)
- A reminder that the user can review all changes using **Source Control** (Ctrl+Shift+G) or `git diff`

### 5. Offer to Save Changes
Ask if the user wants to save the changes. If yes:
- Create a new branch (e.g., `freshness/article-name-MMDDYYYY`)
- Commit the changes with a descriptive message
- Push the branch
- Open a pull request with a summary of the freshness review changes

## Quality Checklist
Before finishing, confirm:
- [ ] All technical claims verified against Tier 1 sources
- [ ] Every correction includes a source citation
- [ ] Code examples validated
- [ ] Version/deprecation status confirmed for mentioned services
- [ ] Broken links fixed or flagged
- [ ] `ms.date` updated to today's date
- [ ] Article metadata reviewed
- [ ] Style and formatting issues addressed
