# Azure Documentation Formatting Rules

Standards for formatting Microsoft Learn articles.

## Code Blocks

Use language-specific fences:

| Language | Fence tag |
|---|---|
| Azure CLI | `azurecli` |
| Azure PowerShell | `azurepowershell` |
| JSON | `json` |
| Bash / Shell | `bash` |
| C# | `csharp` |
| Python | `python` |
| YAML | `yaml` |
| XML | `xml` |
| Bicep | `bicep` |
| ARM template | `json` (with context) |

Always include the language identifier. Never use bare triple backticks.

## Alert Blocks

```markdown
> [!NOTE]
> Supplementary information the reader should know.

> [!TIP]
> Optional advice to help the reader be more successful.

> [!IMPORTANT]
> Essential information required for success.

> [!CAUTION]
> Potential negative consequences of an action.

> [!WARNING]
> Dangerous consequences of an action.
```

## Tables

Use tables for:
- Configuration settings (Setting | Value | Description)
- Portal navigation steps (Field | Value)
- Feature comparisons
- Parameter/property reference

Format:

```markdown
| Setting | Value | Description |
|---|---|---|
| Name | *myResource* | A unique name for the resource. |
| Region | East US | Select the region closest to your users. |
```

## Cross-Links

- **Internal links**: Use relative paths — `[Link text](other-article.md)`
- **Same-folder links**: `[Link text](./sibling-article.md)`
- **Parent-folder links**: `[Link text](../parent-folder/article.md)`
- **Service links**: `[Link text](/azure/service-name/article-name)`
- **Include files**: `[!INCLUDE [description](~/path/to/include.md)]`
- **Never use absolute URLs** for docs.microsoft.com or learn.microsoft.com content

## UI Element Formatting

- **Bold** for UI elements: Select **Create**, then select **Review + create**
- *Italics* for user-provided values: Enter *myResourceGroup* for the name
- `Code` for commands, parameters, file names: Run `az group create`
- "Quotes" for menu paths when needed: Go to "Settings" > "Configuration"

## UI Interaction Verbs

| Action | Verb | Example |
|---|---|---|
| Buttons / links / tabs | select | Select **Create** |
| Text input | enter | Enter *myValue* |
| Drop-down menus | select | Select **East US** |
| Checkboxes | select / clear | Select the **Enable** checkbox |
| Open apps / files | open | Open the Azure portal |
| Navigate menus | go to | Go to **Settings** > **Configuration** |

Do NOT use: click, click on, press, hit, type, choose.

## Heading Rules

- **H1**: One per article, matches the `title` frontmatter field
- **H2**: Main sections — use sentence-style capitalization
- **H3**: Subsections under H2 — sentence-style capitalization
- **No heading skips**: Don't jump from H2 to H4
- **No inline formatting** in headings (no bold, code, or links in heading text)
- **No trailing punctuation** on headings (except `?` for FAQ-style)

## Images and Screenshots

- **Prefer text instructions** over screenshots
- If images are required: `:::image type="content" source="./media/folder/image-name.png" alt-text="Screenshot of the Azure portal showing the resource creation page.":::`
- Alt text format: "Screenshot of..." describing what the reader sees
- Store images in `./media/<article-name>/` folder
- Use `.png` for screenshots, `.svg` for diagrams

## Lists

- **Numbered lists**: For sequential steps (procedures)
  - Use `1.` for all items (Markdown auto-numbers)
  - Maximum 7 steps per numbered list
  - Start each step with an imperative verb
- **Bulleted lists**: For non-sequential items
  - Use `-` (hyphen) for bullets
  - Use parallel construction (all start with same part of speech)

## Miscellaneous

- **Oxford comma**: Always use it
- **Single space** after periods
- **Contractions**: Use them (it's, you'll, don't)
- **Line breaks**: One blank line between paragraphs and before/after code blocks
- **No trailing whitespace** on any line
- **File encoding**: UTF-8 without BOM
