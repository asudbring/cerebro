---
name: content-workflow
description: >-
  Orchestrate Azure documentation workflows — create ADO work items with auto-calculated
  fields, generate git branch names and commit messages, create PR descriptions with AB#
  linking, calculate publish dates, and close work items. Replaces the Content Developer
  MCP server tools with portable skill instructions.
argument-hint: "Describe the workflow step: 'create work item', 'save changes', 'create PR', 'close work item', or 'session startup'"
user-invocable: true
---

# Content workflow skill

This skill orchestrates the full Azure documentation content development lifecycle. It replaces five MCP server tools (`create_work_item_template`, `generate_git_workflow_context`, `generate_pr_description`, `calculate_work_item_completion`, `get_workflow_example`) with portable instructions that Copilot executes directly.

## Workflow 1: Session startup

Run this workflow when a conversation starts or the user mentions starting NEW documentation work. **Skip this workflow** if the user wants to CONTINUE current work (for example, "save my changes", "commit", "push").

### Steps

1. **Check current branch:**

   ```bash
   git branch --show-current
   ```

2. **Check for uncommitted changes:**

   ```bash
   git status --porcelain
   ```

3. **Handle the current state** — one of three scenarios:

   | Scenario | Action |
   |---|---|
   | Feature branch + uncommitted changes | Stash changes → switch to main → sync |
   | Feature branch + clean working tree | Switch to main → sync |
   | Already on main | Sync only |

   **Stash command** (when needed):

   ```bash
   git stash push -m "Auto-stash before switching to main - {YYYY-MM-DD HH:MM}"
   git checkout main
   ```

4. **Sync main with upstream:**

   ```bash
   git fetch upstream main && git rev-list --count HEAD..upstream/main
   ```

   If the count is greater than 0 (main is behind upstream):

   ```bash
   git pull upstream main && git push origin main
   ```

5. Confirm to the user that the environment is ready for new work.

## Workflow 2: Create work item

This is a three-step orchestration: generate template → create in ADO → link to parent.

### Step 1 — Generate the work item template

Calculate all fields from the conversation context and reference data.

**Title**: Use sentence case. Derive from the user's description of the work.

**AreaPath**: Look up the service in [references/service-mappings.md](references/service-mappings.md) and use the corresponding AreaPath value.

**IterationPath**: Calculate using the algorithm in [references/iteration-calculator.md](references/iteration-calculator.md) based on the current date.

**Parent work item ID**: Look up from [references/ado-hierarchy.md](references/ado-hierarchy.md) using the `workflow_type` and the service's category (from the service categories table in service-mappings).

**Required fields:**

| Field | Value |
|---|---|
| `Custom.Modality` | `"Documentation"` |
| `Microsoft.VSTS.Scheduling.StartDate` | Current date in ISO 8601 format |
| `Custom.ProposalType` | Based on the user's action (see mapping below) |
| `System.Tags` | From the approved list + service name + `"cda"` (semicolon-separated) |

**ProposalType mapping:**

| User Action | ProposalType |
|---|---|
| Creating new documentation | `"New"` |
| Updating existing documentation | `"Update"` |
| Reviewing for freshness | `"Review"` |
| Removing documentation | `"Remove"` |
| Deprecating documentation | `"Retire"` |
| Migrating documentation | `"Migrate"` |

**Valid workflow types:** `content-maintenance`, `new-feature`, `pm-enablement`, `css-support`, `content-gap`, `mvp-feedback`, `architecture-center`, `curation`

**Approved tags (ONLY use these):** `content-maintenance`, `mvp-feedback`, `ACC`, `new-feature`, `PM-enablement`, `css-support`, `acc-horizontal-security`, `acc-horizontal-reliability`, `acc-horizontal-supportability`, `curation`, `CSAT`, `Linux`, `content-gap`, `Process`, `Training`. Always add the service name as a tag. Always add `"cda"` as a tag.

**Description format** (use `"format": "Markdown"`):

```markdown
## Problem / Impact
[Customer-facing problem description]

## Solution
[How you're solving it]

## Resources
- Parent Feature: #[parent work item ID]
- PM Contact: [name] ([email])
- Start Date: [YYYY-MM-DD]
- Target Date: [YYYY-MM-DD]
- Modality: Documentation
- Proposal Type: [value]
```

**AcceptanceCriteria format** (use `"format": "Markdown"`):

```markdown
### Success criteria
- [Measurable outcomes]

### Documentation updates
- [Specific files/sections to update]

### Verification
- [How to verify completion]
```

> [!IMPORTANT]
> ALWAYS use `"format": "Markdown"` for Description and AcceptanceCriteria fields. Never use HTML. Never omit the format parameter.

### Step 2 — Create the work item in ADO

Call `@ado` `mcp_ado_wit_create_work_item` with:

- `project`: `"Content"`
- `workItemType`: `"User Story"`
- `fields`: All calculated fields from Step 1

### Step 3 — Link to parent work item

Call `@ado` `mcp_ado_wit_work_items_link` with:

- `project`: `"Content"`
- `updates`: `[{ id: <new work item ID>, linkToId: <parent ID from hierarchy>, type: "parent" }]`

The parent ID comes from [references/ado-hierarchy.md](references/ado-hierarchy.md). If the workflow type has service category mappings, use the service's category to find the correct Feature ID. If the mapping is "none", use the Epic ID directly.

See [references/formatting-guide.md](references/formatting-guide.md) for detailed formatting standards and [references/workflow-examples.md](references/workflow-examples.md) for a complete worked example.

## Workflow 3: Save changes (git workflow)

### Steps

1. **Check current state:**

   ```bash
   git branch --show-current && git status --porcelain
   ```

2. **Determine context:**
   - If already on a feature branch, ask the user: *"Are these changes related to the current branch work, or is this a separate task?"*
   - If on main or it's a separate task → run session startup first, then create a feature branch.

3. **Generate the branch name:**

   Format: `{username}/{service}-{action}-{workItemId}`

   Action mapping:

   | Workflow Type | Action Segment |
   |---|---|
   | `content-maintenance` | `freshness-review` |
   | `new-feature` | Extract from conversation (e.g., "Add FastPath support" → `fastpath-support`) |
   | `css-support` | `css-fix` |
   | `content-gap` | `content-gap` |
   | `pm-enablement` | `pm-content` |

4. **Generate commit messages — ONE COMMIT PER FILE:**

   Use conventional commit format:

   | File Type | Prefix | Example |
   |---|---|---|
   | `.md` files (new) | `feat:` | `feat: Add ExpressRoute quickstart` |
   | `.md` files (updated) | `docs:` | `docs: Update ExpressRoute quickstart for freshness review` |
   | `.md` files (fix) | `fix:` | `fix: Correct ExpressRoute quickstart prerequisites` |
   | Non-`.md` files | `chore:` | `chore: Update toc.yml` |

   > [!IMPORTANT]
   > NEVER include AB# in commit messages.

5. **Execute git commands:**

   ```bash
   git checkout -b {branch-name}
   git add {file1}
   git commit -m "{message1}"
   git add {file2}
   git commit -m "{message2}"
   ```

6. **Ask user for approval before pushing.**

7. **Push after approval:**

   ```bash
   git push -u origin {branch-name}
   ```

## Workflow 4: Create PR

### Steps

1. **Push the branch** (if not already pushed):

   ```bash
   git push -u origin {branch-name}
   ```

2. **Generate the PR description:**

   **Title rules:**
   - Sentence case
   - NO AB# reference
   - Preserve acronyms (ATP, TDE), PascalCase terms (ExpressRoute), and proper nouns (Azure, Microsoft)

   **Body template:**

   ```markdown
   ## Summary
   {Conversation summary, up to 500 characters}

   ## Changes
   ### Documentation updates
   - **{File or section name}** - {Description of changes inferred from conversation context}

   ### Files modified (N files)
   - `path/to/file1.md`
   - `path/to/file2.md`

   ## Testing
   - [ ] Content reviewed for technical accuracy
   - [ ] Links and cross-references verified
   - [ ] Build validated
   - [ ] Microsoft Writing Style Guide compliance checked

   ## Related Work Items
   - [AB#{id}](https://dev.azure.com/msft-skilling/Content/_workitems/edit/{id})
   ```

   **AB# validation:** Only create AB# hyperlinks if you have confirmed the work item exists in ADO. Otherwise use placeholder text like `AB#XXXXX (work item pending)`.

3. **Create the PR:**

   Call `@github` `create_pull_request` with:

   - `owner`: `"MicrosoftDocs"` (the upstream repo, not the fork)
   - `repo`: `"azure-docs-pr"`
   - `title`: The generated title
   - `body`: The generated body
   - `head`: `"{fork-owner}:{branch-name}"` — **CRITICAL: use cross-repo format `owner:branch`**
   - `base`: `"main"`

   > [!IMPORTANT]
   > The `head` parameter MUST use the cross-repo format `{fork-owner}:{branch-name}` because the PR targets the upstream MicrosoftDocs repo from a fork. Example: `"duau:expressroute-freshness-review-789012"`.

4. **Do NOT call `mcp_ado_wit_link_work_item_to_pull_request`.** The AB# reference in the PR body automatically creates the ADO ↔ GitHub link. Manual linking creates duplicates.

## Workflow 5: Save again (additional commits)

Use this workflow when the user has already created a branch and PR but wants to commit more changes.

### Steps

1. **Verify on feature branch:**

   ```bash
   git branch --show-current
   ```

   If not on a feature branch, ask the user which branch to use.

2. **Ask the user:** *"Are these changes related to the current branch work, or is this a separate task?"*
   - If separate task → start a new workflow from the beginning.

3. **Commit new files** (one commit per file, same format as Workflow 3):

   ```bash
   git add {file}
   git commit -m "{message}"
   ```

4. **Push:**

   ```bash
   git push
   ```

5. **Ask the user:** *"PR #{number} now has new commits. Should I update the PR description?"*

6. **If yes**, regenerate the PR description including ALL files (original + new) and update via `@github` `update_pull_request`.

## Workflow 6: Close work item

### Steps

1. **Get PR details** from `@github` — retrieve the merge date, title, and URL.

2. **Calculate the publish date** using the publication schedule:

   | Condition | Publish Time |
   |---|---|
   | PR merged before 10:00 AM PST on a weekday | 10:00 AM PST that day |
   | PR merged between 10:00 AM and 3:00 PM PST on a weekday | 3:00 PM PST that day |
   | PR merged after 3:00 PM PST on a weekday | 10:00 AM PST next business day |
   | PR merged on a weekend | 10:00 AM PST next Monday |

3. **Generate the completion comment:**

   ```markdown
   ## ✅ Work completed

   **PR Merged:** [PR title](PR URL)
   **Merged Date:** {ISO 8601 date}
   **Publish Date:** {Month DD, YYYY at HH:MM AM/PM PST}

   ### Summary
   {Conversation summary, max 300 characters}

   ### Next steps
   - Documentation will publish at **{time}** on **{date}**
   - Monitor live site after publish to verify changes
   ```

4. **Update the work item in ADO:**

   Call `@ado` `mcp_ado_wit_update_work_item` with:
   - `State`: `"Closed"`
   - `Custom.PublishedDate`: The calculated publish date in ISO 8601 format

5. **Add the completion comment:**

   Call `@ado` `mcp_ado_wit_add_work_item_comment` with `format: "markdown"`.

## Core rules

These rules apply to ALL workflows. Violating them causes real problems — follow them strictly.

### Git rules

- **NEVER commit directly to main** — always use a feature branch.
- **ALWAYS sync main before creating a new branch** (Workflow 1 → session startup).
- **ONE COMMIT PER FILE** — never bundle multiple files in one commit.
- **Batch git commands with `&&`** for efficiency (e.g., `git add file && git commit -m "msg"`).
- **Always ask user approval before pushing** to remote.

### ADO rules

- **AB# only in PR body**, never in commit messages.
- **Use `"format": "Markdown"`** (capital M) for Description and AcceptanceCriteria fields.
- **Use `"format": "markdown"`** (lowercase m) for comments.
- **GitHub PR references in ADO must use full URL**, not `#number` — ADO interprets `#number` as a work item reference.

### PR rules

- **Create PRs against upstream `MicrosoftDocs`**, not the fork.
- **Use cross-repo `head` format**: `{fork-owner}:{branch-name}`.
- **Do NOT manually link PRs to work items** — AB# in the body auto-creates the link.

## Reference files

- [references/service-mappings.md](references/service-mappings.md) — Azure Networking service → AreaPath, folder, owner lookup
- [references/ado-hierarchy.md](references/ado-hierarchy.md) — Workflow type → parent Epic/Feature ID mapping
- [references/iteration-calculator.md](references/iteration-calculator.md) — Fiscal year iteration path calculation
- [references/workflow-examples.md](references/workflow-examples.md) — Step-by-step worked examples for all workflows
- [references/formatting-guide.md](references/formatting-guide.md) — ADO field formatting standards and templates
