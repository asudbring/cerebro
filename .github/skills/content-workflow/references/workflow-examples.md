# Workflow examples

Step-by-step worked examples for every content workflow. Use these as patterns when executing workflows.

## Example 1: Session startup

```
User opens a new conversation or says: "Let's start working on ExpressRoute docs."

1. Check current branch:
   git branch --show-current
   → duau/old-feature-branch

2. Check for uncommitted changes:
   git status --porcelain
   → M  articles/firewall/overview.md
   → M  articles/firewall/toc.yml

3. Stash changes (feature branch + uncommitted changes):
   git stash push -m "Auto-stash before switching to main - 2025-12-01 10:30"
   → Saved working directory and index state

4. Switch to main:
   git checkout main
   → Switched to branch 'main'

5. Sync with upstream:
   git fetch upstream main && git rev-list --count HEAD..upstream/main
   → 3

   Main is 3 commits behind upstream:
   git pull upstream main && git push origin main
   → Updated main, pushed to origin

6. Report to user:
   "✅ Environment ready. Main is synced with upstream. Stashed 2 changes from
   duau/old-feature-branch. Ready for new work."
```

## Example 2: Create work item

```
User: "I need to do a freshness review of ExpressRoute documentation. Create a work item."

1. Session startup check:
   git branch --show-current → duau/old-feature-branch
   git status --porcelain → 2 files modified
   → Stash: git stash push -m "Auto-stash before switching to main - 2025-12-01 10:30"
   → Switch: git checkout main
   → Sync: git fetch upstream main && git pull upstream main

2. Calculate work item fields:
   - Title: "Freshness review of ExpressRoute documentation" (sentence case ✓)
   - Service: ExpressRoute
     → AreaPath: Content\Production\Infrastructure\Azure Networking\ExpressRoute
   - Workflow: content-maintenance
     → Parent Epic: 494391 (no service category mapping for content-maintenance)
   - IterationPath: Assume current date is December 1, 2025
     → FY = 2025 + 1 = 26, Quarter = Q2, Month = 12 Dec
     → Content\FY26\Q2\12 Dec
   - Tags: "content-maintenance; ExpressRoute; cda"
   - ProposalType: "Review" (freshness review)
   - Modality: "Documentation"
   - StartDate: "2025-12-01T00:00:00Z"

3. Create in ADO:
   @ado mcp_ado_wit_create_work_item
   - project: "Content"
   - workItemType: "User Story"
   - fields:
     - System.Title: "Freshness review of ExpressRoute documentation"
     - System.AreaPath: "Content\Production\Infrastructure\Azure Networking\ExpressRoute"
     - System.IterationPath: "Content\FY26\Q2\12 Dec"
     - System.Tags: "content-maintenance; ExpressRoute; cda"
     - Custom.Modality: "Documentation"
     - Custom.ProposalType: "Review"
     - Microsoft.VSTS.Scheduling.StartDate: "2025-12-01T00:00:00Z"
     - System.Description: (markdown template with format: "Markdown")
     - Microsoft.VSTS.Common.AcceptanceCriteria: (markdown template with format: "Markdown")
   → Returns work item ID: 789012

4. Link to parent:
   @ado mcp_ado_wit_work_items_link
   - project: "Content"
   - updates: [{ id: 789012, linkToId: 494391, type: "parent" }]
   → Parent link created

5. Report to user:
   "✅ Created User Story 789012: 'Freshness review of ExpressRoute documentation'
   Linked to parent Epic 494391. Ready to begin work."
```

## Example 3: Save changes

```
User: "Save my changes to articles/expressroute/expressroute-howto-circuit-portal-resource-manager.md"

1. Check state:
   git branch --show-current → main
   git status --porcelain → M articles/expressroute/expressroute-howto-circuit-portal-resource-manager.md

2. On main → need to create feature branch. Run sync first:
   git fetch upstream main && git rev-list --count HEAD..upstream/main
   → 0 (already synced)

3. Calculate git context:
   - Username: duau (ExpressRoute owner)
   - Service: expressroute
   - Workflow: content-maintenance → action: freshness-review
   - Work item: 789012
   - Branch: duau/expressroute-freshness-review-789012

4. Generate commit message:
   - File: expressroute-howto-circuit-portal-resource-manager.md (.md file, update)
   - Message: "docs: Update ExpressRoute circuit portal Resource Manager how-to"

5. Execute:
   git checkout -b duau/expressroute-freshness-review-789012
   git add articles/expressroute/expressroute-howto-circuit-portal-resource-manager.md
   git commit -m "docs: Update ExpressRoute circuit portal Resource Manager how-to"

6. Ask user: "Changes committed. Ready to push to origin?"

7. After approval:
   git push -u origin duau/expressroute-freshness-review-789012
   → Branch pushed to origin
```

## Example 4: Create PR

```
User: "Create PR"

1. Ensure branch is pushed:
   git push -u origin duau/expressroute-freshness-review-789012
   → Already up to date (or pushes if needed)

2. Generate PR description:
   - Title: "Update ExpressRoute circuit portal Resource Manager how-to" (no AB#)
   - Body:
     ## Summary
     Updated the ExpressRoute circuit creation how-to guide for freshness review.
     Verified Azure portal steps, updated screenshots references, and corrected
     prerequisite information.

     ## Changes
     ### Documentation updates
     - **ExpressRoute circuit how-to** - Updated portal steps, verified prerequisites

     ### Files modified (1 file)
     - `articles/expressroute/expressroute-howto-circuit-portal-resource-manager.md`

     ## Testing
     - [ ] Content reviewed for technical accuracy
     - [ ] Links and cross-references verified
     - [ ] Build validated
     - [ ] Microsoft Writing Style Guide compliance checked

     ## Related Work Items
     - [AB#789012](https://dev.azure.com/msft-skilling/Content/_workitems/edit/789012)

3. Create PR:
   @github create_pull_request
   - owner: "MicrosoftDocs"
   - repo: "azure-docs-pr"
   - title: "Update ExpressRoute circuit portal Resource Manager how-to"
   - body: (generated above)
   - head: "duau:expressroute-freshness-review-789012"  ← CRITICAL: {fork-owner}:{branch}
   - base: "main"
   → Returns PR #12345

4. Report to user:
   "✅ Created PR #12345 against MicrosoftDocs/azure-docs-pr.
   AB#789012 is linked in the body (auto-links to ADO)."

   NOTE: Do NOT call mcp_ado_wit_link_work_item_to_pull_request.
   The AB# in the PR body auto-creates the link.
```

## Example 5: Save again (additional commits)

```
User: "I also updated the overview article, save that too."

1. Check state:
   git branch --show-current → duau/expressroute-freshness-review-789012
   git status --porcelain → M articles/expressroute/expressroute-introduction.md

2. Already on feature branch. Ask:
   "Are these changes related to the current freshness review, or a separate task?"
   → User: "Same freshness review"

3. Commit the new file:
   git add articles/expressroute/expressroute-introduction.md
   git commit -m "docs: Update ExpressRoute introduction for freshness review"

4. Push:
   git push
   → Pushed to origin

5. Ask: "PR #12345 now has new commits. Should I update the PR description?"
   → User: "Yes"

6. Regenerate PR description with ALL files:

   ## Summary
   Updated ExpressRoute documentation for freshness review. Verified portal steps,
   updated prerequisites, and refreshed the introduction overview.

   ## Changes
   ### Documentation updates
   - **ExpressRoute circuit how-to** - Updated portal steps, verified prerequisites
   - **ExpressRoute introduction** - Refreshed overview content for accuracy

   ### Files modified (2 files)
   - `articles/expressroute/expressroute-howto-circuit-portal-resource-manager.md`
   - `articles/expressroute/expressroute-introduction.md`

   ## Testing
   - [ ] Content reviewed for technical accuracy
   - [ ] Links and cross-references verified
   - [ ] Build validated
   - [ ] Microsoft Writing Style Guide compliance checked

   ## Related Work Items
   - [AB#789012](https://dev.azure.com/msft-skilling/Content/_workitems/edit/789012)

7. Update PR via @github update_pull_request with new body.
```

## Example 6: Close work item

```
User: "Close work item 789012, PR #12345 was merged"

1. Get PR details from @github:
   - PR #12345 merged at 2025-12-03T22:30:00Z (2:30 PM PST)
   - Title: "Update ExpressRoute circuit portal Resource Manager how-to"
   - URL: https://github.com/MicrosoftDocs/azure-docs-pr/pull/12345

2. Calculate publish date:
   - Merged at 2:30 PM PST on Wednesday (weekday ✓)
   - 2:30 PM is between 10:00 AM and 3:00 PM → next window = 3:00 PM PST today
   - Publish date: December 3, 2025 at 3:00 PM PST

3. Generate completion comment:
   ## ✅ Work completed

   **PR Merged:** [Update ExpressRoute circuit portal Resource Manager how-to](https://github.com/MicrosoftDocs/azure-docs-pr/pull/12345)
   **Merged Date:** 2025-12-03
   **Publish Date:** December 03, 2025 at 3:00 PM PST

   ### Summary
   Updated ExpressRoute circuit creation how-to and introduction for freshness
   review. Verified portal steps, prerequisites, and overview content.

   ### Next steps
   - Documentation will publish at **3:00 PM PST** on **December 03, 2025**
   - Monitor live site after publish to verify changes

4. Update ADO work item:
   @ado mcp_ado_wit_update_work_item
   - id: 789012
   - fields:
     - System.State: "Closed"
     - Custom.PublishedDate: "2025-12-03T23:00:00Z" (3:00 PM PST = 11:00 PM UTC)

5. Add completion comment:
   @ado mcp_ado_wit_add_work_item_comment
   - workItemId: 789012
   - comment: (generated above)
   - format: "markdown"

6. Report to user:
   "✅ Work item 789012 closed. Documentation publishes at 3:00 PM PST today.
   Monitor the live site after publish."
```
