---
mode: agent
description: Fact-check and edit the current article in-place, with inline reference comments
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

# Fact-Check & Edit

Fact-check the currently open article against official Microsoft documentation and make corrections directly in the file. Do NOT generate a separate report file. Instead, present all references and reasoning in the chat so the user can review edits using VS Code's diff view.

## Authority Hierarchy

Use sources in this priority order:

### Public Sources

1. **Tier 1 (Primary)**: learn.microsoft.com, azure.microsoft.com — canonical product docs for names, features, configurations, limits, step-by-step guidance, and official recommendations.
2. **Tier 2 (Secondary)**: techcommunity.microsoft.com, devblogs.microsoft.com, developer.microsoft.com, code.visualstudio.com — feature announcements, preview/GA dates, best practices, and design decisions from product teams.
3. **Tier 3 (Code & Specs)**: github.com/microsoft, github.com/Azure — REST API specs (Azure/azure-rest-api-specs) as canonical API definitions; SDK, CLI, and PowerShell source repos for parameters, defaults, and code examples. Some documentation is generated directly from these codebases, making them a ground-truth source.
4. **Tier 4 (Cross-reference only)**: Microsoft Q&A (official platform with Microsoft engineer responses), Stack Overflow, community blogs, GitHub Issues — edge-case clarifications, undocumented behaviors, and community-sourced solutions. Must not override Tier 1–3 sources.

## Steps

### 1. Identify Claims
Read the current file and extract every technical claim:
- Product/service names and descriptions
- Feature capabilities, limitations, and prerequisites
- Version numbers, API references, CLI commands
- Configuration values, default settings, quotas
- Code examples and syntax

#### 1a. Resolve INCLUDES
Scan the article for `[!INCLUDE ...]` references (e.g., `[!INCLUDE [description](path/to/include.md)]`). For each one:
- Open and read the referenced include file
- Extract technical claims from the include content just as you would for the main article
- Track which claims originate from which include file so edits are applied to the correct file

### 2. Verify Against Official Sources
For each claim:
- Search `microsoft_docs_search` for the topic on learn.microsoft.com
- Use `microsoft_docs_fetch` to retrieve full documentation pages
- Use `microsoft_code_sample_search` for code examples
- Check for deprecation notices or recent changes
- Validate code examples using `get_errors`

### 3. Edit the File Directly
For any inaccurate, outdated, or incomplete content:
- Make the correction directly in the current file
- Preserve the article's existing tone, style, and formatting
- Update `ms.date` to today's date
- Do NOT add HTML comments or reference markers into the article itself — keep the article clean

#### 3a. Edit INCLUDES Files
If an inaccuracy originates from an INCLUDES file:
- Make the correction directly in the include file, just as you would for the main article
- Preserve the include file's existing formatting
- Note in the chat summary which file was edited (main article vs. include file path)

### 4. Present References in Chat
After ALL edits are complete, present a single summary in chat with this format for each change:

---

**Edit N: [brief description]**
- **File**: [main article or include file path]
- **Line(s)**: [approximate line number(s)]
- **What changed**: [original text] → [new text]
- **Why**: [brief explanation]
- **Source(s)**:
  - [Title](learn.microsoft.com URL)
  - [Title](secondary URL if used)

---

Repeat for each edit made.

### 5. Final Summary
End with:
- Total number of edits made
- A reminder that the user can review all changes using **Source Control** (Ctrl+Shift+G) or by running `git diff` to see the full diff
- Ask if they want to accept the changes, revert any specific edit, or commit

## Rules
- **DO** edit the file directly — that's the whole point of this skill
- **DO NOT** create a separate report file
- **DO NOT** embed references or comments inside the article markdown
- **DO** present all sources and reasoning in the chat response
- **DO** make edits incrementally so VS Code tracks each change
- **DO** update `ms.date` in the YAML front matter to today's date
- **DO** resolve and fact-check all `[!INCLUDE ...]` referenced files
- **DO** edit INCLUDES files directly when they contain inaccuracies

## Quality Checklist
Before finishing, confirm:
- [ ] All technical claims verified against Tier 1 sources
- [ ] Every edit has a corresponding reference in the chat summary
- [ ] Code examples validated
- [ ] Version/deprecation status confirmed
- [ ] ms.date updated
- [ ] Article formatting and style preserved
- [ ] All `[!INCLUDE ...]` files read and fact-checked
- [ ] INCLUDES edits noted with file path in chat summary
