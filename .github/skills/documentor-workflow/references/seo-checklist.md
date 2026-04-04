# SEO Checklist for Azure Documentation

## Title (ms.title / `<title>`)

| Rule | Requirement |
|---|---|
| Length | 30-65 characters (including spaces) |
| Case | **Title case** (capitalize major words) |
| Primary keyword | Include near the beginning |
| Uniqueness | Must differ from H1 and description |
| Gerunds | Avoid -ing words at start |
| Error codes | Prefix with error code for troubleshooting articles |
| Brand names | Use official product names (Azure Virtual Machines, not VMs) |

### Title quality checklist

- [ ] Contains primary keyword
- [ ] 30-65 characters
- [ ] Title case applied correctly
- [ ] Different from H1 heading
- [ ] Different from meta description
- [ ] No gerund (-ing) at start
- [ ] Would make sense as a search result

## Description (ms.description / `<meta name="description">`)

| Rule | Requirement |
|---|---|
| Length | 120-165 characters (including spaces) |
| Primary keyword | At the beginning of the description |
| Call-to-action | Include one (Learn how to..., Find out..., Discover...) |
| Uniqueness | Must differ from title and H1 |
| Voice | Active language, compelling copy |
| Purpose | Convince searcher to click |

### Description quality checklist

- [ ] Contains primary keyword at start
- [ ] 120-165 characters
- [ ] Includes call-to-action
- [ ] Different from title
- [ ] Different from H1
- [ ] Uses active voice
- [ ] Would compel a click from search results

## H1 Heading

| Rule | Requirement |
|---|---|
| Case | **Sentence case** (NOT title case) |
| Primary keyword | Include in the H1 |
| Gerunds | No -ing words |
| Uniqueness | Can overlap with title but should not be identical |
| Count | Exactly one H1 per article |

> [!IMPORTANT]
> H1 uses **sentence case** while title uses **title case**. This is a common mistake — subheadings also use sentence case.

## Intro Paragraph

| Rule | Requirement |
|---|---|
| Primary keyword | Must appear in the first or second sentence |
| Length | 2-3 sentences recommended |
| Purpose | Establish what the article covers and for whom |
| Customer intent | Align with the `ms.custom: customer-intent` value |

## Subheadings (H2, H3, H4)

| Rule | Requirement |
|---|---|
| Case | **Sentence case** (NOT title case) |
| Secondary keywords | Include where natural |
| Gerunds | Avoid -ing words |
| Standard headings | Preserve template headings: Prerequisites, Related content, Next steps |
| Hierarchy | No skipped levels (H2 → H3 → H4) |
| Periods | No periods at the end of headings |

### Standard headings to preserve

These headings are part of the Azure docs template and must be kept as-is:
- Prerequisites
- Related content
- Next steps
- Clean up resources
- Overview (for product-overview articles)

## Image Alt Text

| Rule | Requirement |
|---|---|
| Length | 40-150 characters |
| Format | Start with "Screenshot of..." or "Diagram of..." |
| Content | Describe what the image shows, not what it is |
| Keywords | Include relevant keywords when natural |
| Decorative images | Use empty alt text `alt=""` only for purely decorative images |

## Internal Linking

| Rule | Requirement |
|---|---|
| Relative links | Use relative paths for links within the same docset |
| Anchor text | Use descriptive text, not "click here" or "this article" |
| Related content | Include 3-5 related links in the Related content section |
| Next steps | Include 1-3 actionable next steps with links |
