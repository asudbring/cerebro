---
name: documentor-workflow
description: "Editorial quality workflows for Azure documentation — SEO optimization, metadata generation, engagement analysis, markdown auto-fix, sensitive identifier replacement, and link validation. Replicates DocuMentor extension capabilities for use in agent mode or without the extension."
argument-hint: "Describe the editorial task: review SEO, suggest title/description, fix markdown, check engagement, validate links, or run a full editorial review on the current article"
user-invocable: true
---

# Documentor Workflow — Editorial Quality for Azure Docs

Use this skill to run editorial quality workflows on Azure documentation articles. It covers SEO optimization, metadata generation, engagement improvement, markdown formatting fixes, link validation, and sensitive identifier replacement.

> **Dual-mode**: If the DocuMentor extension (`@docuMentor`) is installed, you can also use its chat participant directly. This skill provides the same capabilities for agent mode or environments without the extension.

## Workflow Selection

Choose the appropriate workflow based on the task:

| Task | Workflow | DocuMentor equivalent |
|---|---|---|
| Quick targeted fixes | [Quick Edit Review](#quick-edit-review) | `suggestQuickEdits` |
| Comprehensive editorial review | [Full Edit Review](#full-edit-review) | `suggestFullEdits` |
| Generate or improve title | [Suggest Title](#suggest-title) | `suggestTitle` |
| Generate or improve description | [Suggest Description](#suggest-description) | `suggestDescription` |
| Generate customer intent | [Suggest Customer Intent](#suggest-customer-intent) | `suggestCustomerIntent` |
| SEO audit | [SEO Review](#seo-review) | `suggestSEO` |
| Engagement metric improvement | [Engagement Review](#engagement-review) | `suggestEngagement` |
| Fix markdown formatting | [Auto-Fix Markdown](#auto-fix-markdown) | `autoFixMarkdown` |
| Check for broken links | [Validate Links](#validate-links) | `validateLinks` |
| Update ms.date | [Update Date](#update-date) | `updateMsDate` |

---

## Quick Edit Review

Scan the article for common issues and suggest targeted fixes:

1. Check frontmatter completeness (title, description, ms.date, ms.topic, ms.service, ms.custom, customer intent)
2. Verify title (30-65 chars, title case, primary keyword near beginning)
3. Verify description (120-165 chars, unique from title/H1, includes CTA)
4. Scan for passive voice — rewrite to active voice using "you" to address readers
5. Check for sensitivity issues — replace any real GUIDs, secrets, or IDs with approved placeholders (see `references/sensitive-identifiers.md`)
6. Verify sentence-style capitalization on all headings (except product names)
7. Check that procedures have ≤ 10 steps and begin with a verb
8. Present findings as a numbered list of suggested edits with before/after examples

## Full Edit Review

Comprehensive editorial review covering all quality dimensions:

1. Run all Quick Edit Review checks
2. Apply SEO Review checklist
3. Apply Engagement Review analysis
4. Verify writing style against Microsoft Writing Style Guide:
   - Use contractions (it's, you'll, don't)
   - Get to the point fast — lead with what matters most
   - Use bigger ideas, fewer words
   - Write like you speak — read it aloud
   - Address reader as "you," refer to Microsoft as "we"
5. Check formatting rules (see `references/autofix-rules.md`):
   - Code fences have correct language identifiers
   - Alert blocks use proper syntax (`> [!NOTE]`, `> [!TIP]`, etc.)
   - Tables are properly formatted
   - Lists follow Azure docs conventions
6. Validate all links
7. Produce a comprehensive report organized by: Critical, Important, Suggestions

## Suggest Title

Generate or improve the article title following these rules:

1. **Length**: 30-65 characters (including spaces)
2. **Case**: Title case (capitalize major words)
3. **Keywords**: Include primary keyword near the beginning
4. **Uniqueness**: Must differ from H1 and description
5. **No gerunds**: Avoid -ing words at start
6. **Error codes**: Prefix with error code if article is troubleshooting
7. Provide 3 title options ranked by SEO effectiveness
8. Show character count for each option

## Suggest Description

Generate or improve the meta description:

1. **Length**: 120-165 characters (including spaces)
2. **Keywords**: Include primary keyword at the beginning
3. **Uniqueness**: Must differ from title and H1
4. **CTA**: Include a call-to-action (Learn how to..., Find out..., Discover...)
5. **Active language**: Use active voice, compelling copy
6. Provide 3 description options ranked by click-through potential
7. Show character count for each option

## Suggest Customer Intent

Generate the customer intent metadata field using agile user story format:

```
As a <type of user>, I want <what?> so that <why?>
```

1. Identify the target user role from the article content
2. Identify the primary task or goal
3. Identify the business value or outcome
4. Generate 2-3 customer intent options
5. Validate each follows the exact format above

## SEO Review

Audit the article against the SEO checklist (see `references/seo-checklist.md`):

1. **Title** — 30-65 chars, title case, primary keyword, unique from H1/description
2. **Description** — 120-165 chars, CTA, primary keyword at beginning, unique
3. **H1** — Sentence case (NOT title case), primary keyword, no gerunds
4. **Intro paragraph** — Primary keyword in first or second sentence
5. **Subheadings** — Sentence case (NOT title case), secondary keywords, no gerunds, preserve standard template headings (Prerequisites, Related content, Next steps)
6. **Image alt text** — 40-150 chars, starts with "Screenshot of..." or "Diagram of..."
7. Present results as a checklist with pass/fail status and remediation for each item

## Engagement Review

Analyze the article for engagement metric improvements (see `references/engagement-checklist.md`):

1. **Bounce rate** — Check intro hooks, visual elements, content relevance, page load factors
2. **Click-through rate** — Check link placement, anchor text quality, CTA clarity
3. **Copy-try-scroll rate** — Check code sample quality, procedure clarity, scanability
4. **Dwell rate** — Check content depth, readability, multimedia, internal linking
5. **Exit rate** — Check next steps section, related content links, progressive disclosure
6. For each metric, provide: current assessment, specific issues found, remediation steps

## Auto-Fix Markdown

Systematically fix markdown formatting issues (see `references/autofix-rules.md`):

1. Fix heading hierarchy (no skipped levels, single H1)
2. Ensure blank lines before and after headings, code blocks, lists, and alerts
3. Fix list formatting (consistent markers, proper nesting, blank lines between top-level items)
4. Fix code fence language identifiers (use `azurecli` not `bash` for Azure CLI, `azurepowershell` not `powershell` for Azure PowerShell)
5. Fix alert syntax to standard format: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!CAUTION]`, `> [!WARNING]`
6. Fix table alignment and formatting
7. Remove trailing whitespace
8. Ensure file ends with single newline
9. Apply all fixes and show a summary of changes made

## Validate Links

Check all links in the article:

1. Identify all markdown links `[text](url)` and reference links
2. For relative links — verify the target file exists in the repository
3. For absolute links — flag any links to `learn.microsoft.com` that should be relative
4. For anchor links — verify the heading target exists
5. Check for bare URLs that should be formatted as markdown links
6. Report: working links, broken links, links needing conversion, and suggested fixes

## Update Date

Update the `ms.date` frontmatter field:

1. Locate the `ms.date` field in the YAML frontmatter
2. Update to today's date in `MM/DD/YYYY` format
3. Confirm the change

---

## Reference Files

For detailed checklists and rules, load these resources as needed:

- `references/seo-checklist.md` — Complete SEO optimization rules and examples
- `references/metadata-rules.md` — Title, description, and customer-intent specifications
- `references/engagement-checklist.md` — Engagement metric troubleshooting and remediation
- `references/sensitive-identifiers.md` — Approved GUID/secret replacement values by type and severity
- `references/autofix-rules.md` — Markdown formatting rules and code fence language identifiers
