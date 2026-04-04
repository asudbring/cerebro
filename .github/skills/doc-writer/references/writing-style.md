# Microsoft Writing Style for Azure Documentation

Core writing principles for Microsoft Learn articles.

## Brand Voice

Write with a voice that is:

- **Warm and relaxed** — Be natural and conversational. Use contractions. Write like you speak.
- **Crisp and clear** — Use simple, everyday words. Get to the point fast.
- **Ready to lend a hand** — Be empowering, not condescending. Guide the reader to success.

## Top 10 Writing Tips

1. **Bigger ideas, fewer words** — Cut unnecessary words. Every sentence should earn its place.
2. **Write like you speak** — Read your text aloud. If it sounds stiff, revise.
3. **Use contractions** — "You'll", "it's", "don't" — not "You will", "it is", "do not".
4. **Get to the point fast** — Lead with the most important information. No long preambles.
5. **Be brief** — Short paragraphs (2-4 sentences). Short sentences (under 25 words).
6. **Sentence-style capitalization** — Capitalize only the first word and proper nouns in headings.
7. **Skip periods** on short headings, bullet items, and table cells.
8. **Oxford comma** — Always: "VMs, storage, and networking" not "VMs, storage and networking".
9. **Single space** after periods.
10. **Start procedures with verbs** — "Select the resource group" not "The resource group should be selected".

## Capitalization

- **Sentence-style** is the default for all headings H2 and below
- **Title case** only for: H1 titles, product names, service names, feature names when they're proper nouns
- **CRITICAL**: H2+ headings use sentence-style casing — capitalize only the first word and proper nouns
  - Correct: `## Create a virtual machine`
  - Wrong: `## Create A Virtual Machine`
- **Standardized headings** are always sentence-style: Prerequisites, Next steps, Related content, Clean up resources

## Procedures

- Maximum **7 numbered steps** per section. If you need more, break into sub-sections.
- Start each step with an **imperative verb**: "Select", "Enter", "Open", "Copy"
- One action per step. If a step has substeps, use a lettered or bulleted sub-list.
- End the intro to a procedure with a colon.

## Tone and Audience

- Write for **experienced professionals** who are new to this specific Azure feature
- Don't over-explain fundamentals — link to prerequisite articles instead
- Use **"you"** to address the reader directly. Avoid "we", "our", or "one".
- Use **active voice**: "The function processes the message" not "The message is processed by the function"
- Avoid jargon without context. If you must use a technical term, link to its definition on first use.

## Content Structure

- **Lead with context** — Start each section with 1-2 sentences explaining what and why before diving into how.
- **Progressive disclosure** — Present the most common scenario first, then edge cases.
- **Scannable content** — Use headings, tables, and lists to let readers scan for what they need.
- **Self-contained sections** — Each H2 section should be understandable on its own when possible.

## Specific Word Choices

| Use | Don't use |
|---|---|
| select | click, click on, press, hit |
| enter | type, input |
| go to | navigate to |
| make sure | ensure (in procedures) |
| want to | wish to, desire to |
| need to | must (unless security/safety) |
| can | is able to |
| about | approximately |
| for example | e.g. |
| that is | i.e. |
| sign in | log in, login |
| user name | username (in some contexts) |

## Customer Intent

Every article should have a customer intent comment in the frontmatter:

```
#customer intent: As a <type of user>, I want <what?> so that <why?>.
```

This follows the agile user story format and guides the article's focus. Examples:

- `#customer intent: As a cloud administrator, I want to configure health probes so that I can monitor the availability of my backend instances.`
- `#customer intent: As a developer, I want to deploy a function app so that I can run serverless code in Azure.`

## SEO Essentials

- **Title**: 30–65 characters, primary keyword near the beginning, title case
- **Description**: 120–165 characters, unique, active language, primary keyword at start, include a call to action
- **H1**: Matches the title, uses sentence casing, contains the primary keyword
- **Subheadings**: Use sentence casing, include secondary keywords where natural
- **Image alt text**: Format as "Screenshot of..." describing what the reader sees
