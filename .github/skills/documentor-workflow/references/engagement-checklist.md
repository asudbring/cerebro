# Engagement Checklist for Azure Documentation

Use this checklist to diagnose and improve engagement metrics for Azure documentation articles.

## Bounce Rate

Bounce rate measures users who leave without interacting. High bounce rate indicates the article doesn't meet user expectations.

### Diagnosis

| Symptom | Likely cause | Remediation |
|---|---|---|
| High bounce from search | Title/description mismatch with content | Align title and description with actual article content; update primary keywords |
| Bounce within first 10 seconds | Intro doesn't hook reader | Rewrite intro to immediately address the user's problem; state what they'll accomplish |
| Bounce after scrolling | Content doesn't answer the question | Check customer-intent alignment; ensure the article delivers what it promises |
| Bounce on specific device types | Layout/formatting issues | Check table rendering, code block overflow, image sizing |

### Remediation steps

1. Verify the intro paragraph directly addresses the customer intent
2. Ensure the H1 clearly communicates what the article covers
3. Add a brief "In this article" summary for long articles
4. Check that prerequisite information is upfront, not buried
5. Verify the article answers the primary question within the first two sections

## Click-Through Rate (CTR)

CTR measures how often users click links within the article to continue their journey.

### Diagnosis

| Symptom | Likely cause | Remediation |
|---|---|---|
| Low CTR on related content | Links buried at bottom | Move key links inline where relevant; add contextual cross-references |
| Low CTR on next steps | Generic "Learn more" text | Use specific, action-oriented anchor text: "Configure health probes" not "Learn more" |
| Low CTR on code samples | Samples not actionable | Add "Try it" links to Azure portal, Cloud Shell, or GitHub samples |
| Users skip CTA buttons | CTA not compelling | Use verb-first CTAs: "Deploy to Azure", "Try this quickstart" |

### Remediation steps

1. Replace "click here" and "learn more" with descriptive anchor text
2. Place the most important links in the first half of the article
3. Add inline links where concepts are first introduced
4. Ensure Next steps section has 1-3 specific, actionable links
5. Add related content links (3-5) at the end

## Copy-Try-Scroll Rate

Measures user engagement with code samples, procedures, and interactive content.

### Diagnosis

| Symptom | Likely cause | Remediation |
|---|---|---|
| Low code copy rate | Code not ready to use | Provide complete, runnable examples with all variables defined |
| Users don't follow procedures | Steps too complex or unclear | Break into substeps; ensure each step starts with a verb; limit to 10 steps |
| Low scroll depth | Content not scannable | Add headings every 2-3 paragraphs; use lists and tables; add visual breaks |
| Users skip tabbed content | Tabs not discoverable | Ensure tab labels are clear and descriptive |

### Remediation steps

1. Verify all code samples are complete and runnable (no undefined variables)
2. Add copy buttons to code blocks (automatic in Azure docs with fenced code)
3. Break procedures longer than 10 steps into sub-procedures
4. Start each procedure step with an action verb
5. Add screenshots for complex UI procedures
6. Use bullet lists for non-sequential information

## Dwell Rate

Measures how long users spend on the article. Low dwell time may mean the content is too shallow or too confusing.

### Diagnosis

| Symptom | Likely cause | Remediation |
|---|---|---|
| Very low dwell time | Content too shallow | Add more detail, examples, or code samples |
| Extremely high dwell time | Content confusing or disorganized | Restructure with clear headings; add summary section; simplify language |
| Dwell drops off at specific section | Section is confusing or irrelevant | Rewrite the section; consider splitting into a separate article |
| Consistent moderate dwell | Article is well-structured | No action needed — this is the target |

### Remediation steps

1. Ensure content depth matches the article type (concept articles need more depth than quickstarts)
2. Add examples for abstract concepts
3. Use tables to present comparison information
4. Add diagrams or architecture images for complex topics
5. Link to deeper-dive articles for advanced topics

## Exit Rate

Measures where users leave the site. High exit rate on non-terminal pages indicates missing navigation.

### Diagnosis

| Symptom | Likely cause | Remediation |
|---|---|---|
| High exit at end of article | No next steps or related content | Add Next steps section with 1-3 actionable links |
| High exit mid-article | Content doesn't answer question | Check customer intent alignment; add anchor links to relevant sections |
| High exit on prerequisites | Prerequisites too complex | Simplify or link to quickstart; add estimated time |
| Exit to external sites | Missing internal equivalent | Add or link to Microsoft-hosted equivalent content |

### Remediation steps

1. Every article must have a "Next steps" section with specific, linked actions
2. Every article must have a "Related content" section with 3-5 links
3. Use progressive disclosure — link to advanced topics rather than including everything
4. Add breadcrumb-friendly headings so users know where they are
5. Consider adding "Was this page helpful?" feedback mechanisms

## Engagement Review Workflow

When performing a full engagement review:

1. Read the article from the customer's perspective — what did they search for?
2. Check customer-intent alignment with actual content
3. Evaluate each metric section above
4. Prioritize fixes: bounce rate > copy-try-scroll > CTR > dwell > exit
5. Provide specific before/after edit suggestions for each issue found
6. Estimate impact: High / Medium / Low for each recommendation
