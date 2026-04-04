# Article Templates

Complete scaffolds for each Azure documentation article type. Copy the appropriate template and fill in all placeholders.

## How-to Article Template

```markdown
---
title: <Verb + noun — 30-65 chars, title case>
description: <"Learn how to..." — 120-165 chars>
author: <GitHub username>
ms.author: <Microsoft alias>
ms.service: <azure-service-name>
ms.topic: how-to
ms.date: <MM/DD/YYYY>
#customer intent: As a <role>, I want <what> so that <why>.
---

# <Same as title>

<Intro paragraph — 1-3 sentences. "In this article, you learn how to [task] using [service].">

## Prerequisites

- An Azure account with an active subscription. [Create an account for free](https://azure.microsoft.com/free/?WT.mc_id=A261C142F).
- <Previous articles completed>
- <Runtimes or SDKs installed>
- <Packages or libraries>
- <Tools (CLI, portal access, etc.)>
- <Credentials or role assignments>

## Sign in to Azure

<Portal: Sign in to the [Azure portal](https://portal.azure.com).>
<CLI: Sign in with `az login`.>

## <First task section — imperative verb>

<Brief context for this task — 1-2 sentences.>

1. <Step — imperative verb, max 7 steps per section>
1. <Step>
1. <Step>

## <Second task section>

<Steps for next task.>

## Clean up resources

<When you no longer need the resources, delete them. Explain how.>

[!INCLUDE [clean-up-resources](~/reusable-content/ce-skilling/azure/includes/clean-up-resources.md)]

## Related content

- [Link text](relative-path.md)
- [Link text](relative-path.md)
- [Link text](relative-path.md)
```

## Concept Article Template

```markdown
---
title: <Noun phrase — 30-65 chars, title case>
description: <"Learn about..." — 120-165 chars>
author: <GitHub username>
ms.author: <Microsoft alias>
ms.service: <azure-service-name>
ms.topic: concept-article
ms.date: <MM/DD/YYYY>
#customer intent: As a <role>, I want <what> so that <why>.
---

# <Same as title>

<Intro paragraph — "X is a Y that does Z." Explain what the technology is and why it matters.>

## <Key aspect or feature>

<Non-procedural explanation. Use diagrams, tables, or lists to clarify.>

## <Another aspect>

<Explain how this aspect works, when to use it, tradeoffs.>

## <Comparison or considerations>

<Compare options, list constraints, or describe decision criteria.>

## Related content

- [Link text](relative-path.md)
- [Link text](relative-path.md)
- [Link text](relative-path.md)
```

## Quickstart Template

```markdown
---
title: "Quickstart: <Verb + noun — 30-65 chars, title case>"
description: <"In this quickstart, you..." — 120-165 chars>
author: <GitHub username>
ms.author: <Microsoft alias>
ms.service: <azure-service-name>
ms.topic: quickstart
ms.date: <MM/DD/YYYY>
#customer intent: As a <role>, I want <what> so that <why>.
---

# Quickstart: <Verb + noun>

<Intro — 1-2 sentences. What the user accomplishes and why it matters.>

## Prerequisites

- An Azure account with an active subscription. [Create an account for free](https://azure.microsoft.com/free/?WT.mc_id=A261C142F).
- <Minimal prerequisites for quickstart>

## <Main task — single focused goal>

1. <Step>
1. <Step>
1. <Step>

## Verify the results

<Show user how to confirm success.>

## Clean up resources

<Delete resources if applicable.>

## Next steps

> [!div class="nextstepaction"]
> [Next article title](next-article.md)

- [Link text](relative-path.md)
- [Link text](relative-path.md)
```

## Tutorial Template

```markdown
---
title: "Tutorial: <Verb + noun — 30-65 chars, title case>"
description: <"In this tutorial, you learn how to..." — 120-165 chars>
author: <GitHub username>
ms.author: <Microsoft alias>
ms.service: <azure-service-name>
ms.topic: tutorial
ms.date: <MM/DD/YYYY>
#customer intent: As a <role>, I want <what> so that <why>.
---

# Tutorial: <Verb + noun>

<Intro — what the user builds or learns. List what they'll do:>

In this tutorial, you learn how to:

> [!div class="checklist"]
> - <First objective>
> - <Second objective>
> - <Third objective>

## Prerequisites

- An Azure account with an active subscription. [Create an account for free](https://azure.microsoft.com/free/?WT.mc_id=A261C142F).
- <Prerequisites specific to this tutorial>

## <Step 1 heading — progressive build>

<Context + steps. Each section builds on the previous one.>

## <Step 2 heading>

<Next progressive step.>

## <Step 3 heading>

<Continue building toward the goal.>

## Clean up resources

<Delete everything created during the tutorial.>

## Next steps

<Suggest the next logical tutorial or article.>

> [!div class="nextstepaction"]
> [Next tutorial title](next-tutorial.md)
```

## Overview Template

```markdown
---
title: "What is <product>?"
description: <"Learn about <product>..." — 120-165 chars>
author: <GitHub username>
ms.author: <Microsoft alias>
ms.service: <azure-service-name>
ms.topic: overview
ms.date: <MM/DD/YYYY>
#customer intent: As a <role>, I want <what> so that <why>.
---

# What is <product>?

<Paragraph 1 — Brief product info: what it is, who it's for, core value proposition.>

<Paragraph 2 — New capabilities or unique differentiators.>

<Paragraph 3 — Point readers to related documentation and Learn modules.>

## Key features

- **<Feature>** — <Brief description>
- **<Feature>** — <Brief description>
- **<Feature>** — <Brief description>

## Get started

- [Quickstart: <task>](quickstart-article.md)
- [Tutorial: <task>](tutorial-article.md)
- [<Concept topic>](concept-article.md)

## Related content

- [Link text](relative-path.md)
- [Link text](relative-path.md)
```
