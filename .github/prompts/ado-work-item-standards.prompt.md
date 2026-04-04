---
mode: agent
description: Create or validate ADO work items per Azure Core Content Standards — ensures required fields, proper descriptions, and linked PRs
tools:
  - microsoft-learn-mcp-server/microsoft_docs_search
  - microsoft-learn-mcp-server/microsoft_docs_fetch
  - read/readFile
  - read/problems
  - search/codebase
  - search/fileSearch
  - search/textSearch
  - edit/editFiles
  - execute/runInTerminal
  - execute/getTerminalOutput
  - todo
---

# ADO Work Item Standards — Azure Core Content

Create or validate Azure DevOps work items that comply with **Azure Core Content Standards**. Every work item must clearly articulate the customer problem, the proposed solution, measurable success criteria, and a tracking plan — before any work begins.

## Required Information

Gather the following from the user. If any field is missing, prompt for it before proceeding.

### 1. Customer problem to solve
> What is the specific customer pain point, confusion, or gap this work addresses?

- Must be stated from the **customer's perspective**, not an internal task description.
- Reference support signals where possible (CSS incidents, feedback comments, freshness flags, GitHub issues).
- Bad example: "Article needs updating."
- Good example: "Customers configuring ExpressRoute Global Reach frequently misconfigure peering locations because the current article doesn't list supported region pairs, leading to failed deployments and support tickets."

### 2. How you'll solve the problem
> What content changes, new articles, or restructuring will you deliver?

- Be specific: list the files, sections, or new pages involved.
- Include the type of work: freshness review, new article, rewrite, screenshot update, code sample update, etc.
- Reference the official service documentation or feature page that serves as the source of truth.

### 3. What does success look like?
> Describe the desired end state once this work is published.

- Frame it as a customer outcome, not a checklist item.
- Bad example: "Article is updated."
- Good example: "Customers can follow the step-by-step guide to configure Global Reach without needing to open a support ticket. The article reflects the current portal experience and lists all supported region pairs."

### 4. How will you measure success?
> What metrics or signals will confirm the problem is resolved?

- Use concrete, observable indicators. Examples:
  - Reduction in related CSS tickets within 30/60/90 days
  - Decrease in negative documentation feedback (thumbs-down) on the article
  - Increase in page views or time-on-page indicating useful content
  - Successful validation by a subject-matter expert or PM
  - Zero broken links or build warnings after publish

## Default Field Values

| Field | Default | Notes |
|-------|---------|-------|
| **Start Date** | Current date (`{{today}}`) | Set automatically if not specified by the user |
| **Due Date** | End of current month | Set automatically if not specified by the user |
| **State** | New | Initial state for newly created work items |
| **Priority** | 2 | Default priority; adjust based on severity of customer impact |

## Associated GitHub PR

**Always ask the user:**

> Is there an associated GitHub PR for this work? If so, provide the PR number or URL.

- If a PR exists, link it in the work item description using markdown format: `[#PR_NUMBER](https://github.com/MicrosoftDocs/<repo>/pull/PR_NUMBER)`
- Do **not** use bare `#PR_NUMBER` in ADO — ADO interprets that as a work item reference.
- If no PR exists yet, note in the work item that a PR will be created and linked once the branch is ready.
- The `AB#<work_item_id>` tag in the PR body creates the automatic bidirectional link between GitHub and ADO.

## Work Item Description Template

Structure the ADO work item description in Markdown using this format:

```markdown
## Customer problem to solve
<Enter your answer>

## How you'll solve the problem
<Enter your answer>

## What does success look like?
<Enter your answer>

## How will you measure success?
<Enter your answer>

## Problem / Impact
{description text, or "Update {service} documentation to ensure accuracy and completeness."}

## Solution
Review and update {service} documentation following Microsoft Writing Style Guide and content quality standards.

## Resources
- **Parent Feature**: #{parentId}
- **Start Date**: {YYYY-MM-DD}
- **Target Date**: {targetDate} ← only if provided
- **PM Contact**: {pmContact} ← only if provided
- **Tags**: {workflowType}; {service}; cda
- **Modality**: Documentation
- **Proposal Type**: {Update|New}
- **Article**: [Article title](https://learn.microsoft.com/en-us/azure/...)
- **PR**: [#PR_NUMBER](https://github.com/MicrosoftDocs/<repo>/pull/PR_NUMBER) *(if applicable)*
- **Related work items**: AB#XXXXX *(if applicable)*
```

## Acceptance Criteria Template

```markdown
### Success criteria
- [ ] All four required sections (problem, solution, success, measurement) are populated
- [ ] Customer problem is stated from the customer's perspective
- [ ] Files/articles to be changed are identified
- [ ] Success metrics are concrete and measurable
- [ ] Content is accurate and up-to-date
- [ ] All links are valid and working
- [ ] Follows Microsoft Writing Style Guide
- [ ] Headings use sentence casing
- [ ] ms.date updated to publish date after changes are merged
- [ ] GitHub PR linked (or noted as pending)

### Documentation updates
- [ ] Review and update {service} articles
- [ ] Verify code samples are tested
- [ ] Update metadata (ms.date, ms.service)

### Verification tasks
- [ ] Content reviewed and updated
- [ ] Technical accuracy validated against learn.microsoft.com
- [ ] Article builds without warnings or broken links
- [ ] Reviewed by peer or subject-matter expert
- [ ] PR created and approved
- [ ] Changes validated in staging
```

## Workflow

### Creating a new work item
1. Ask the user for the **service name** and **workflow type** (content-maintenance, new-feature, pm-enablement, css-support, content-gap, mvp-feedback, architecture-center, curation).
2. Collect answers for all four required fields. Coach the user on quality if answers are vague.
3. Ask: **"Is there an associated GitHub PR?"**
4. Set **Start Date** to today if not specified.
5. Set **Due Date** to end of current month if not specified.
6. Generate the work item using the description and acceptance criteria templates above.
7. Present the completed work item for user review before creating it in ADO.

### Validating an existing work item
1. Retrieve the work item from ADO.
2. Check that all four required sections are present and well-written.
3. Verify dates are set (flag if Start Date or Due Date are missing).
4. Check for a linked GitHub PR.
5. Report any gaps and suggest improvements.

## Quality Standards

- **Sentence casing** for all headings (capitalize only the first word and proper nouns).
- **No internal jargon** in customer-facing problem statements — write as if the customer will read it.
- **Specific file paths** in the solution section — not just "update the article."
- **Measurable outcomes** in the success metrics — not "article is better."
- **Markdown format** for all Description and AcceptanceCriteria fields in ADO.
- **Always use `format: "markdown"`** when calling ADO MCP tools to write comments or descriptions.
