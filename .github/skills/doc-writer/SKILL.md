---
name: doc-writer
description: "Scaffold and write production-ready Azure documentation articles (how-to, concept, quickstart, tutorial, overview). Generates frontmatter, article structure, and content following Microsoft Learn writing standards."
argument-hint: "Describe the article type and topic, e.g. 'how-to article for configuring Azure Load Balancer health probes'"
user-invocable: true
---

# Doc-Writer — Azure Article Authoring Skill

Write production-ready how-to, concept, quickstart, tutorial, or overview articles for any Azure service on Microsoft Learn.

## When to Use

- Writing a **new** Azure documentation article from scratch
- Scaffolding article structure before filling in content
- Converting rough notes or outlines into properly formatted Learn articles
- Ensuring correct frontmatter, heading structure, and formatting conventions

## Workflow

### Step 1 — Determine the Article Type

Ask the user or infer from context:

| Type | Purpose | Title Pattern | `ms.topic` |
|---|---|---|---|
| **How-to** | Task-oriented steps for a specific goal | `verb + noun` (no "How to" prefix) | `how-to` |
| **Concept** | Non-procedural explanation of a feature or technology | `noun phrase + concepts` or `noun overview` | `concept-article` |
| **Quickstart** | Fast, single-task onboarding for first-time users | `Quickstart: verb + noun` | `quickstart` |
| **Tutorial** | Multi-step progressive learning experience | `Tutorial: verb + noun` | `tutorial` |
| **Overview** | Product-level introduction (GMPs only) | `What is <product>?` or `<product> overview` | `overview` |

### Step 2 — Generate Frontmatter

Use the template from [references/article-templates.md](references/article-templates.md) and fill in:

```yaml
---
title: <Descriptive title — see title rules below>
description: <One sentence, 120-165 characters, starts with "Learn how to..." or similar>
author: <GitHub username>
ms.author: <Microsoft alias>
ms.service: <azure-service-name>
ms.topic: <article type from Step 1>
ms.date: <MM/DD/YYYY — current date>
#customer intent: As a <role>, I want <what> so that <why>.
---
```

**Title rules**: 30–65 characters, primary keyword near beginning, title case, no gerunds, no special characters.

**Description rules**: 120–165 characters, unique, active language, primary keyword at beginning, include a call to action.

**Customer intent**: Agile user story format — `As a <type of user>, I want <what?> so that <why?>`.

### Step 3 — Scaffold the Article Structure

Apply the correct structure for the article type. See [references/article-templates.md](references/article-templates.md) for complete templates.

**How-to structure:**
1. H1 title
2. Intro paragraph — "In this article, you learn how to..."
3. `## Prerequisites` — ordered: previous articles → runtimes → packages → tools → sample code → hardware → credentials
4. Main task sections (H2 per major step)
5. `## Clean up resources` (if resources were created)
6. `## Related content` — 3–4 bullet links

**Concept structure:**
1. H1 title
2. Intro — "X is a Y that does Z" pattern
3. H2s for key aspects, features, characteristics
4. No numbered steps (non-procedural)
5. `## Related content`

**Quickstart structure:**
1. H1 title
2. Intro — brief context + what the user accomplishes
3. `## Prerequisites`
4. Single focused task sections
5. `## Clean up resources`
6. `## Next steps`

**Tutorial structure:**
1. H1 title with "Tutorial:" prefix
2. Intro — what the user builds/learns, progressive outline
3. `## Prerequisites`
4. Progressive H2 sections (each builds on previous)
5. `## Clean up resources`
6. `## Next steps`

### Step 4 — Write Content

Apply the Microsoft writing style from [references/writing-style.md](references/writing-style.md):

- **Voice**: Warm and relaxed, crisp and clear, ready to lend a hand
- **Brevity**: Bigger ideas, fewer words. Get to the point fast
- **Procedures**: Max 7 numbered steps per section, imperative verbs
- **UI interactions**: "select" not "click", "enter" not "type", "open" for apps/files, "go to" for menus/tabs
- **Casing**: Sentence-style capitalization for all headings (CRITICAL — do NOT use title case for H2+ headings)
- **Contractions**: Use them — write like you speak
- **Lists**: Oxford comma, single space after periods

### Step 5 — Apply Formatting Standards

See [references/formatting-rules.md](references/formatting-rules.md) for complete rules.

**Key rules:**
- Tables for all settings/configuration steps
- Language-specific code fences: `azurecli`, `azurepowershell`, `json`, `bash`, `csharp`, `python`
- Alert blocks: `> [!NOTE]`, `> [!IMPORTANT]`, `> [!CAUTION]`, `> [!TIP]`, `> [!WARNING]`
- Cross-links with relative paths: `[Link text](other-article.md)`
- No screenshots — use text instructions and tables
- Bold for UI elements: **Create**, **Save**, **Next**
- Italics for user-provided values: *myResourceGroup*

### Step 6 — Validate

Before presenting the article, verify:
- [ ] All frontmatter fields present and valid
- [ ] Title: 30–65 chars, title case, primary keyword included
- [ ] Description: 120–165 chars, active voice, CTA included
- [ ] Customer intent comment present
- [ ] Correct heading hierarchy (H1 → H2 → H3, no skips)
- [ ] Sentence-style capitalization on H2+ headings
- [ ] Prerequisites section present (if applicable)
- [ ] Related content or Next steps section at the end
- [ ] No placeholders or TODO markers remain
- [ ] Sensitive identifiers use approved fake values (see `/documentor-workflow` skill for approved GUIDs)

### Step 7 — Publishing Guidance

After the article is written:
1. Save to `articles/<service-name>/<filename>.md`
2. Update `TOC.yml` in the service folder — add entry under the correct section
3. Update `overview.md` or `index.yml` if the article covers a new capability
4. Verify all frontmatter fields are present

## File Naming Conventions

| Type | Pattern | Example |
|---|---|---|
| How-to | `[action]-[resource].md` | `create-storage-account.md` |
| Quickstart | `deploy-[resource]-[method].md` | `deploy-vm-portal.md` |
| Tutorial | `[action]-[resource].md` | `backup-virtual-machine.md` |
| Concept | `[topic]-concepts.md` | `networking-concepts.md` |
| Overview | `overview.md` or `[topic]-overview.md` | `overview.md` |
