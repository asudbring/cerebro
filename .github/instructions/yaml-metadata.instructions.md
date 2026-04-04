---
applyTo: "**/*.yml"
---

# YAML Metadata Standards for Microsoft Learn

## TOC Files (toc.yml)
- Follow the learn.microsoft.com TOC schema
- Use `name` and `href` for leaf nodes
- Use `name` and `items` for branch nodes
- Maintain alphabetical ordering within service groups
- `href` values are relative paths to .md files

## Index/Landing Pages (index.yml)
- Follow the learn.microsoft.com landing page schema
- Include `metadata` block with title, description, ms.service
- Use `conceptualContent`, `tools`, or `additionalContent` sections as appropriate

## General YAML Rules
- Use 2-space indentation (never tabs)
- Quote strings containing special YAML characters (`:`, `#`, `{`, `}`)
- Use ISO 8601 dates where dates are required
