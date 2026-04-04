---
applyTo: "**/*.md"
---

# Microsoft Learn Markdown Authoring Standards

## Heading Rules
- Use ATX-style headings (`#`, `##`, etc.) — never setext
- Sentence-case: capitalize only the first word and proper nouns
- Maximum heading depth: H4 (`####`)
- Every article must have exactly one H1 (`#`) matching the `title` in frontmatter
- No skipping heading levels (H2 → H4 is invalid)
- Blank line before and after every heading

## Code Blocks
- Always use fenced code blocks with a language identifier
- Supported identifiers: `azurecli`, `azurepowershell`, `json`, `bicep`, `yaml`, `xml`, `csharp`, `python`, `bash`, `output`, `console`, `http`, `rest`, `kusto`
- Never use `shell` or `sh` — use `bash` or `azurecli`
- Use `output` for command output, not `text` or `plaintext`

## Alerts and Notes
- Use triple-bracket syntax: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!CAUTION]`, `> [!WARNING]`
- Content follows on the next line with `>` continuation

## Links
- Use relative links to other articles in the same repo: `[text](relative-path.md)`
- Use INCLUDE files for shared content: `[!INCLUDE [name](~/path/to/include.md)]`
- External links open in new tab: `[text](url)` (the build system handles target)

## Lists
- Use `-` for unordered lists (not `*` or `+`)
- Numbered lists use `1.` for every item (auto-numbered by renderer)
- Blank line between list items only if they contain multiple paragraphs

## Images
- Format: `:::image type="content" source="media/filename.png" alt-text="Description":::`
- Never use raw markdown `![]()` syntax for learn.microsoft.com articles

## Tables
- Use pipe tables with header separator
- Align content left (default) — no alignment colons needed
- Keep tables simple; use definition lists for complex data

## Metadata
- Every article requires YAML frontmatter with: title, description, ms.service, ms.topic, ms.date, author, ms.author
- ms.date format: MM/DD/YYYY
- ms.topic values: concept-article, how-to, overview, quickstart, tutorial, reference
