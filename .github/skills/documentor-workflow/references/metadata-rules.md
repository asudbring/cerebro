# Metadata Rules for Azure Documentation

## Title (`title:` in YAML frontmatter)

- **Length**: 30-65 characters (including spaces)
- **Case**: Title case (capitalize all major words; lowercase articles, prepositions, conjunctions unless first word)
- **Primary keyword**: Place near the beginning
- **Must be unique** from H1 and description
- **No gerunds** (-ing words) at the start
- **Error code prefix**: For troubleshooting articles, start with the error code

### Title examples

| Good | Bad | Why |
|---|---|---|
| Configure Health Probes for Azure Load Balancer | Configuring Azure Load Balancer Health Probes in Your Environment | Too long (67 chars), starts with gerund |
| Troubleshoot Error 502 - Azure Application Gateway | Azure Application Gateway Errors | Too vague, missing error code |
| Create a Virtual Network Using Azure Portal | How to Create a Virtual Network | Missing service context |

## Description (`description:` in YAML frontmatter)

- **Length**: 120-165 characters (including spaces)
- **Primary keyword**: At the beginning
- **Call-to-action**: Include one action verb phrase (Learn how to..., Find out..., Discover how..., Use...to...)
- **Must be unique** from title and H1
- **Active voice**: Use compelling, action-oriented copy
- **No trailing period** unless it's a complete sentence

### Description examples

| Good (142 chars) | Bad (98 chars) |
|---|---|
| Learn how to configure health probes for Azure Load Balancer to monitor backend pool instance availability and route traffic effectively. | This article describes health probes in Azure Load Balancer. |

## H1 Heading (first `#` in article body)

- **Case**: Sentence case (only capitalize first word and proper nouns)
- **Primary keyword**: Include in the H1
- **No gerunds** at the start
- **Exactly one H1** per article
- **Different from title** (title is title case; H1 is sentence case)

### H1 examples

| Good | Bad | Why |
|---|---|---|
| Configure health probes for Azure Load Balancer | Configure Health Probes For Azure Load Balancer | Title case used instead of sentence case |
| What is Azure Virtual Network? | Understanding Azure Virtual Network | Gerund start |

## Customer Intent (`ms.custom: customer-intent="..."`)

Use the agile user story format:

```
As a <type of user>, I want <what?> so that <why?>
```

### Rules

1. **User role**: Use a specific Azure role (developer, network administrator, DevOps engineer, IT administrator, solution architect)
2. **What**: State the specific task or information need
3. **Why**: State the business outcome or value

### Customer intent examples

| Article type | Customer intent |
|---|---|
| How-to | `As a network administrator, I want to configure health probes for Azure Load Balancer so that I can monitor backend instance availability.` |
| Concept | `As a solution architect, I want to understand Azure Virtual Network peering so that I can design cross-region network connectivity.` |
| Quickstart | `As a developer, I want to deploy my first Azure Function so that I can run serverless code in the cloud.` |
| Troubleshooting | `As an IT administrator, I want to resolve error 502 on Application Gateway so that I can restore application availability.` |

## ms.date

- **Format**: `MM/DD/YYYY`
- **When to update**: Update when making substantive content changes, not for typo fixes
- **Freshness target**: Articles should be reviewed at least every 12 months

## ms.topic

| Article type | ms.topic value |
|---|---|
| How-to guide | `how-to` |
| Conceptual | `concept-article` |
| Quickstart | `quickstart` |
| Tutorial | `tutorial` |
| Overview | `overview` |
| Reference | `reference` |
| Troubleshooting | `troubleshooting` |
| FAQ | `faq` |
| Sample | `sample` |

## Required frontmatter fields

Every Azure docs article must include these YAML frontmatter fields:

```yaml
---
title: # 30-65 chars, title case
description: # 120-165 chars, CTA, primary keyword
ms.date: # MM/DD/YYYY
ms.topic: # article type
ms.service: # Azure service slug
ms.custom: # customer-intent="As a..."
author: # GitHub username
ms.author: # Microsoft alias
---
```
