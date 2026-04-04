# ADO work item formatting standards

## Critical rule: always use markdown format

When creating or updating ADO work items:

- ✅ ALWAYS use `"format": "Markdown"` for Description and AcceptanceCriteria
- ✅ ALWAYS use `"format": "markdown"` for comments
- ❌ NEVER use HTML format
- ❌ NEVER omit the format parameter

## Required fields

| Field | Value | Notes |
|---|---|---|
| `Custom.Modality` | `"Documentation"` | Always set for content work items |
| `Microsoft.VSTS.Scheduling.StartDate` | Current date ISO 8601 | When work item is created |
| `Custom.ProposalType` | Based on action | New, Update, Review, Remove, Retire, Migrate |
| `System.Tags` | From approved list | Semicolon-separated, always include service name + "cda" |

## Description template

Use `"format": "Markdown"` when setting `System.Description`:

```markdown
## Problem / Impact
[Customer-facing problem description — what is broken, outdated, or missing]

## Solution
[How you're solving it — what content changes are being made]

## Resources
- Parent Feature: #[parent work item ID]
- PM Contact: [name] ([email])
- Start Date: [YYYY-MM-DD]
- Target Date: [YYYY-MM-DD]
- Modality: Documentation
- Proposal Type: [value]
```

## Acceptance criteria template

Use `"format": "Markdown"` when setting `Microsoft.VSTS.Common.AcceptanceCriteria`:

```markdown
### Success criteria
- [Measurable outcomes — e.g., "All CLI examples verified against latest API version"]

### Documentation updates
- [Specific files/sections — e.g., "articles/expressroute/quickstart.md: Update prerequisites"]

### Verification
- [How to verify completion — e.g., "Build passes, links validated, content reviewed"]
```

## Comments

Always use `format: "markdown"` (lowercase m) when calling `mcp_ado_wit_add_work_item_comment`.

Example comment:

```markdown
## Status update

Updated the quickstart guide with current portal screenshots and verified all CLI commands.

**Files modified:**
- `articles/expressroute/quickstart.md`

**Next steps:**
- PR pending review
```

## PR references in work items

When referencing GitHub PRs inside ADO work items or comments:

- ✅ Use the full GitHub URL: `[PR 12345](https://github.com/MicrosoftDocs/azure-docs-pr/pull/12345)`
- ❌ Do NOT use `#12345` — ADO interprets `#` followed by a number as a work item reference

## Approved tags

Only use tags from this list (semicolon-separated in the `System.Tags` field):

- `content-maintenance`
- `mvp-feedback`
- `ACC`
- `new-feature`
- `PM-enablement`
- `css-support`
- `acc-horizontal-security`
- `acc-horizontal-reliability`
- `acc-horizontal-supportability`
- `curation`
- `CSAT`
- `Linux`
- `content-gap`
- `Process`
- `Training`

**Always** add the service name (e.g., `ExpressRoute`, `NAT Gateway`) as an additional tag.

**Always** add `cda` as an additional tag.

Example: `"content-maintenance; ExpressRoute; cda"`

## ProposalType values

| User Action | ProposalType Value |
|---|---|
| Creating new documentation | `"New"` |
| Updating existing documentation | `"Update"` |
| Reviewing for freshness | `"Review"` |
| Removing documentation | `"Remove"` |
| Deprecating documentation | `"Retire"` |
| Migrating documentation | `"Migrate"` |

## Field format summary

| Field | Format Parameter | Case |
|---|---|---|
| `System.Description` | `"format": "Markdown"` | Capital M |
| `Microsoft.VSTS.Common.AcceptanceCriteria` | `"format": "Markdown"` | Capital M |
| Comment (via `mcp_ado_wit_add_work_item_comment`) | `format: "markdown"` | Lowercase m |
