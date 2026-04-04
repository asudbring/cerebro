# Auto-Fix Rules for Azure Documentation Markdown

## Heading Rules

| Rule | Fix |
|---|---|
| Multiple H1 headings | Keep only the first H1; demote others to H2 |
| Skipped heading levels (H2 → H4) | Insert appropriate intermediate heading or adjust level |
| Title case on H2-H6 | Convert to sentence case (capitalize only first word and proper nouns) |
| Period at end of heading | Remove trailing period |
| Missing blank line before heading | Add blank line |
| Missing blank line after heading | Add blank line |

## Code Fence Language Identifiers

Use the correct language identifier for Azure documentation:

| Context | Correct | Incorrect |
|---|---|---|
| Azure CLI commands | `azurecli` | `bash`, `shell`, `cli` |
| Azure PowerShell commands | `azurepowershell` | `powershell`, `ps`, `ps1` |
| ARM templates | `json` | `arm`, `armjson` |
| Bicep templates | `bicep` | (none) |
| Azure Resource Graph | `kusto` | `kql` |
| .NET / C# | `csharp` | `cs`, `c#` |
| Python | `python` | `py` |
| JavaScript | `javascript` | `js` |
| TypeScript | `typescript` | `ts` |
| Bash scripts (non-Azure CLI) | `bash` | `sh`, `shell` |
| PowerShell scripts (non-Azure) | `powershell` | `ps`, `ps1` |
| YAML configuration | `yaml` | `yml` |
| XML | `xml` | (none) |
| HTTP requests | `http` | `rest`, `api` |
| Console output | `output` | `console`, `text`, `plaintext` |
| Dockerfile | `dockerfile` | `docker` |
| Terraform | `terraform` | `tf`, `hcl` |

### Code fence formatting

- Always include a language identifier — never use bare ` ``` `
- Add a blank line before and after code fences
- Don't nest code fences

## Alert Block Syntax

Use standard alert syntax for Azure docs:

```markdown
> [!NOTE]
> Supplemental information the user should know.

> [!TIP]
> Optional information to help the user be more successful.

> [!IMPORTANT]
> Essential information required for user success.

> [!CAUTION]
> Negative potential consequences of an action.

> [!WARNING]
> Dangerous consequences of an action.
```

### Alert fixes

| Issue | Fix |
|---|---|
| `> **Note:**` or `> Note:` | Convert to `> [!NOTE]` |
| `> **Tip:**` or `> Tip:` | Convert to `> [!TIP]` |
| `> **Important:**` or `> Important:` | Convert to `> [!IMPORTANT]` |
| `> **Warning:**` or `> Warning:` | Convert to `> [!WARNING]` |
| `> **Caution:**` or `> Caution:` | Convert to `> [!CAUTION]` |
| Missing blank line before alert | Add blank line |
| Missing blank line after alert | Add blank line |
| Alert text not on `> ` continuation line | Move to `> ` prefixed line |

## List Rules

| Rule | Fix |
|---|---|
| Mixed list markers (`-` and `*`) | Standardize to `-` for unordered lists |
| Missing blank line before list | Add blank line |
| Missing blank line after list | Add blank line |
| Nested list wrong indentation | Use 2-space or 4-space indentation consistently |
| Ordered list wrong numbering | Use `1.` for all items (auto-numbered) or sequential numbering |
| Missing blank line between complex list items | Add blank line between items that contain sub-content |

## Table Rules

| Rule | Fix |
|---|---|
| Missing header separator row | Add `|---|---|` row |
| Inconsistent column count | Pad shorter rows with empty cells |
| Missing leading/trailing pipes | Add pipes to all rows |
| Missing blank line before table | Add blank line |
| Missing blank line after table | Add blank line |

## Link Rules

| Rule | Fix |
|---|---|
| Bare URLs | Wrap in markdown link syntax `[display text](url)` |
| `https://learn.microsoft.com/...` absolute links to same docset | Convert to relative paths |
| Links with locale `/en-us/` | Remove locale segment |
| Broken anchor links | Fix to match actual heading (lowercase, hyphens for spaces) |
| "click here" anchor text | Replace with descriptive text |
| Link text same as URL | Replace with descriptive text |

## Image Rules

| Rule | Fix |
|---|---|
| Missing alt text `![]()` | Add descriptive alt text (40-150 chars) |
| Alt text too short (< 40 chars) | Expand to be more descriptive |
| Alt text too long (> 150 chars) | Shorten while keeping meaning |
| Missing "Screenshot of" prefix | Add appropriate prefix ("Screenshot of..." or "Diagram of...") |
| Image without surrounding blank lines | Add blank lines before and after |
| Broken image path | Verify path and fix |

## Spacing and Whitespace

| Rule | Fix |
|---|---|
| Trailing whitespace on lines | Remove trailing spaces |
| Multiple consecutive blank lines | Reduce to single blank line |
| No newline at end of file | Add single trailing newline |
| Tabs for indentation | Convert to spaces |
| Extra spaces between words | Reduce to single space |
| Missing blank line before/after block elements | Add blank line |

## Frontmatter Rules

| Rule | Fix |
|---|---|
| Missing `---` delimiters | Add opening and closing `---` |
| Missing required fields | Add with placeholder values and flag for review |
| `ms.date` in wrong format | Convert to `MM/DD/YYYY` |
| Title over 65 characters | Flag for review (don't auto-truncate) |
| Description over 165 characters | Flag for review (don't auto-truncate) |
| Description under 120 characters | Flag for review (don't auto-expand) |
