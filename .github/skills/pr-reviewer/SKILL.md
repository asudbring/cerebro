---
name: pr-reviewer
description: >-
  Review pull requests against the Microsoft Writing Style Guide. Analyzes changed
  markdown files for contractions, passive voice, word choice, future tense, sentence
  structure, code formatting, and metadata issues. Generates per-file suggestions with
  line numbers and recommended rewrites.
argument-hint: "Provide a PR URL or 'review PR #number in owner/repo'"
user-invocable: true
---

# PR Reviewer

Review pull requests against the Microsoft Writing Style Guide. This skill analyzes changed markdown files and generates actionable suggestions organized by file and category.

## Accepting PR input

The skill accepts PR references in two forms:

- **GitHub PR URL** — Parse `owner`, `repo`, and `number` from the URL (e.g., `https://github.com/MicrosoftDocs/azure-docs-pr/pull/12345`)
- **Explicit parameters** — The user provides owner, repo, and PR number directly (e.g., "review PR #12345 in MicrosoftDocs/azure-docs-pr")

Extract the owner, repo, and PR number from whichever format is provided.

## Workflow

### a. Get changed files

1. Use the GitHub MCP `pull_request_read` tool with method `get_files` to retrieve the list of changed files from the PR.
2. Filter the list to include only `.md` files. Skip all other file types.

### b. Read each changed file

1. For each `.md` file, use the GitHub MCP `get_file_contents` tool to retrieve the full file content from the PR's head branch.
2. Store the content with line numbers for reference in suggestions.

### c. Run style checks

1. Load the style patterns from [references/style-patterns.md](references/style-patterns.md).
2. For each file, scan every line against all 98 patterns across 7 categories.
3. Record matches with: file path, line number, matched text, suggested replacement, category, and note.

### d. Skip protected ranges

Before reporting a match, verify the match is NOT inside any of these protected ranges:

- **Fenced code blocks** — Lines between ` ``` ` delimiters (including the language identifier line)
- **Inline code** — Text between single backticks (`` ` ``)
- **YAML frontmatter** — Content between the opening `---` and closing `---` at the top of the file
- **HTML comments** — Content between `<!--` and `-->`

Matches inside protected ranges must be silently skipped.

### e. Generate suggestions

Group suggestions by file, then by category within each file. Each suggestion includes:

- Line number
- The matched text (quoted)
- The suggested replacement or rewrite guidance
- A brief note explaining the rationale

### f. Identify agent-rewrite suggestions

Some suggestions cannot be fixed with a simple find-and-replace (e.g., passive voice restructuring, sentence reordering). Flag these as **"Agent rewrite recommended"** so the reviewer knows manual or AI-assisted editing is needed.

### g. Create review summary report

Compile all findings into a structured report (see Output format below).

## Style check categories

See [references/style-patterns.md](references/style-patterns.md) for the complete list of 98 patterns across 7 categories:

1. **Contractions** (18 patterns) — Expand formal language to contractions for conversational tone
2. **Passive voice** (29 patterns) — Convert passive constructions to active voice
3. **Word choice** (18 patterns) — Replace complex or jargon words with simpler alternatives
4. **Future tense** (15 patterns) — Convert future tense ("will") to present tense
5. **Sentence structure** (14 patterns) — Fix dangling participles, address reader as "you", use imperative mood
6. **Code formatting** (2 patterns) — Correct inline code formatting issues
7. **Metadata** (2 patterns) — Fix heading and section naming conventions

## Output format

```
# PR Review: {title}

## Summary
- Files reviewed: N
- Total suggestions: N
- By category: contractions (N), passive voice (N), word choice (N), future tense (N), sentence structure (N), code formatting (N), metadata (N)

## File: path/to/file.md

### Contractions
- Line {N}: "cannot" → "can't" (Use contractions for conversational tone)
- Line {N}: "do not" → "don't" (Use contractions for conversational tone)

### Passive Voice
- Line {N}: "is implemented" → Consider "[subject] implements..." (Active voice preferred) ⚙️ Agent rewrite recommended
- Line {N}: "is required" → Consider "you must" or "requires" (Active voice preferred)

### Word Choice
- Line {N}: "utilize" → "use" (Simpler alternative)

### Future Tense
- Line {N}: "will create" → "creates" (Use present tense)

### Sentence Structure
- Line {N}: "When configuring" → "When you configure" (Second person + active voice)

### Code Formatting
- Line {N}: `getData()` in prose → Remove parentheses outside code blocks

### Metadata
- Line {N}: "## See Also" → "## Related content"
```

## Review scopes

The skill supports three review scopes:

| Scope | Description |
|---|---|
| `style-only` | Run only style checks (contractions, passive voice, word choice, future tense, sentence structure, code formatting, metadata) |
| `technical-only` | Check only technical accuracy: code block language identifiers, metadata completeness, link validity, image syntax |
| `full` | Run both style and technical checks (default) |

If the user does not specify a scope, default to `full`.
