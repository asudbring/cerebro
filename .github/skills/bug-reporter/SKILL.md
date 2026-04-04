---
name: bug-reporter
description: >-
  Report bugs in the Content Developer tooling to the development team. Generates
  structured bug reports with system info, repro steps, and expected/actual behavior.
  Creates ADO Bug work items with proper routing and parent linking.
argument-hint: "Describe the bug: 'report a bug with work item creation' or 'the PR description tool generated wrong output'"
user-invocable: true
---

# Bug reporter

Report bugs in the Content Developer tooling to the development team.

## When to use

Use this skill when you encounter issues with:
- Content workflow skills or agent behavior
- Work item template generation
- Git workflow recommendations
- PR description generation
- Any other Content Developer automation

## Bug report template

Collect the following information:

### Required fields

1. **Title**: Short description prefixed with "Bug: " (e.g., "Bug: PR description missing AB# link")
2. **What happened**: Describe what occurred
3. **Expected behavior**: What should have happened
4. **Actual behavior**: What actually happened

### Optional fields

5. **Steps to reproduce**: Numbered list of steps
6. **Workaround**: How you fixed or worked around the issue
7. **System info**: OS, VS Code version, browser

## Creating the ADO bug

Create a Bug (not User Story) work item with these fields:

```json
{
  "project": "Content",
  "workItemType": "Bug",
  "fields": [
    {"name": "System.Title", "value": "Bug: {title}"},
    {"name": "System.AreaPath", "value": "Content\\Production\\Infrastructure\\Azure Networking"},
    {"name": "System.IterationPath", "value": "{calculate using iteration calculator}"},
    {"name": "System.AssignedTo", "value": "duau@microsoft.com"},
    {"name": "Microsoft.VSTS.Common.Priority", "value": 2},
    {"name": "System.Tags", "value": "cda; bug-tracking; bug"},
    {
      "name": "System.Description",
      "value": "## Problem / Impact\n{what_happened}\n\n## Expected Behavior\n{expected}\n\n## Actual Behavior\n{actual}",
      "format": "Markdown"
    },
    {
      "name": "Microsoft.VSTS.Common.AcceptanceCriteria",
      "value": "### Verification\n- Bug is resolved\n- Tested and confirmed fixed\n- No regression introduced",
      "format": "Markdown"
    },
    {
      "name": "Microsoft.VSTS.TCM.ReproSteps",
      "value": "### Steps to reproduce\n{steps}\n\n### Workaround\n{workaround}\n\n### System Info\n{system_info}",
      "format": "Markdown"
    }
  ]
}
```

## Parent linking

Link all bugs to the Bug Tracking Feature:

```json
{
  "project": "Content",
  "updates": [{"id": "{new_bug_id}", "linkToId": 540846, "type": "parent"}]
}
```

## System info collection

Before creating the bug, collect:

```bash
echo "=== System Info ==="
echo "OS: $(uname -s 2>/dev/null || echo Windows)"
echo "VS Code: $(code --version | head -1 2>/dev/null || echo 'N/A')"
echo "Node.js: $(node --version 2>/dev/null || echo 'N/A')"
echo "Git: $(git --version 2>/dev/null || echo 'N/A')"
```
