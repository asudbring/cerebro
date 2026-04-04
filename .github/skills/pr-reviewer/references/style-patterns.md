# Style Patterns Reference

Complete list of 98 style patterns for PR review, organized by category. All patterns follow the [Microsoft Writing Style Guide](https://learn.microsoft.com/style-guide/welcome/).

## Protected ranges

Before flagging a match, skip any text inside these protected ranges:

- Fenced code blocks (` ``` ` ... ` ``` `)
- Inline code (`` ` `` ... `` ` ``)
- YAML frontmatter (`---` ... `---` at start of file)
- HTML comments (`<!--` ... `-->`)

---

## Category 1: Contractions (18 patterns)

Use contractions for a conversational, user-friendly tone. Case-insensitive matching.

| # | Find | Replace with | Note |
|---|------|-------------|------|
| 1 | cannot | can't | Conversational tone |
| 2 | could not | couldn't | Conversational tone |
| 3 | do not | don't | Conversational tone |
| 4 | does not | doesn't | Conversational tone |
| 5 | will not | won't | Conversational tone |
| 6 | would not | wouldn't | Conversational tone |
| 7 | should not | shouldn't | Conversational tone |
| 8 | is not | isn't | Conversational tone |
| 9 | are not | aren't | Conversational tone |
| 10 | was not | wasn't | Conversational tone |
| 11 | were not | weren't | Conversational tone |
| 12 | have not | haven't | Conversational tone |
| 13 | has not | hasn't | Conversational tone |
| 14 | it is | it's | Conversational tone |
| 15 | that is | that's | Conversational tone |
| 16 | there is | there's | Conversational tone |
| 17 | you are | you're | Conversational tone |
| 18 | they are | they're | Conversational tone |

---

## Category 2: Passive voice (29 patterns)

Active voice is clearer, more direct, and easier to translate. When flagging passive voice, suggest an active rewrite. Many of these require agent-assisted rewrites because the subject must be inferred from context.

| # | Find | Suggested rewrite | Note |
|---|------|-------------------|------|
| 1 | is implemented | Consider active: "[subject] implements..." | Agent rewrite recommended |
| 2 | are implemented | Consider active voice | Agent rewrite recommended |
| 3 | was implemented | Consider active voice | Agent rewrite recommended |
| 4 | is used | Consider "uses" or "you use" | |
| 5 | are used | Consider active voice | Agent rewrite recommended |
| 6 | was used | Consider active voice | Agent rewrite recommended |
| 7 | is called | Consider "[subject] calls..." | Agent rewrite recommended |
| 8 | are called | Consider active voice | Agent rewrite recommended |
| 9 | was called | Consider active voice | Agent rewrite recommended |
| 10 | is defined | Consider "[subject] defines..." | Agent rewrite recommended |
| 11 | are defined | Consider active voice | Agent rewrite recommended |
| 12 | was defined | Consider active voice | Agent rewrite recommended |
| 13 | is created | Consider "[subject] creates..." | Agent rewrite recommended |
| 14 | are created | Consider active voice | Agent rewrite recommended |
| 15 | was created | Consider active voice | Agent rewrite recommended |
| 16 | is returned | Consider "[method] returns..." | Agent rewrite recommended |
| 17 | are returned | Consider active voice | Agent rewrite recommended |
| 18 | was returned | Consider active voice | Agent rewrite recommended |
| 19 | is required | Consider "you must" or "requires" | |
| 20 | is specified | Consider "you specify" or "specifies" | |
| 21 | is configured | Consider "you configure" or "configures" | |
| 22 | is enabled | Consider "you enable" or "enables" | |
| 23 | is disabled | Consider "you disable" or "disables" | |
| 24 | is supported | Consider "[feature] supports..." | Agent rewrite recommended |
| 25 | is provided | Consider "[subject] provides..." | Agent rewrite recommended |
| 26 | is stored | Consider "[system] stores..." | Agent rewrite recommended |
| 27 | is executed | Consider "[subject] runs..." | Agent rewrite recommended |
| 28 | is performed | Consider "[subject] performs..." | Agent rewrite recommended |
| 29 | is recommended | Consider "we recommend" or "you should" | |

---

## Category 3: Word choice (18 patterns)

Use simpler, more direct language. Avoid jargon, unnecessary phrases, and formal alternatives when a plain-language option exists.

| # | Find | Replace with | Note |
|---|------|-------------|------|
| 1 | issues | problems | User-facing content per Style Guide |
| 2 | maintain | keep | Simpler language |
| 3 | eliminate | remove | Direct action verb |
| 4 | rather than | instead of | Style Guide preference |
| 5 | utilize | use | Simpler alternative |
| 6 | in order to | to | Remove unnecessary words |
| 7 | due to the fact | because | Simplify |
| 8 | may (as possibility) | might | Style Guide preference |
| 9 | leverage | use | Avoid jargon |
| 10 | functionality | feature | Simpler noun |
| 11 | provides the ability to | lets you | Direct language |
| 12 | has the ability to | can | Direct language |
| 13 | commence | start | Plain language |
| 14 | terminate | stop | Plain language |
| 15 | subsequently | then | Simpler |
| 16 | previously | earlier | Simpler |
| 17 | prior to | before | Plain language |
| 18 | in the event that | if | Simplify |

---

## Category 4: Future tense (15 patterns)

Use present tense to describe what happens. Future tense ("will") implies uncertainty and adds unnecessary words.

| # | Find | Replace with |
|---|------|-------------|
| 1 | will be | is |
| 2 | will create | creates |
| 3 | will return | returns |
| 4 | will use | uses |
| 5 | will call | calls |
| 6 | will run | runs |
| 7 | will start | starts |
| 8 | will show | shows |
| 9 | will display | displays |
| 10 | will generate | generates |
| 11 | will produce | produces |
| 12 | will cause | causes |
| 13 | will enable | enables |
| 14 | will allow | allows |
| 15 | will prevent | prevents |

---

## Category 5: Sentence structure (14 patterns)

Address the reader directly as "you." Use active constructions and imperative mood in procedures.

| # | Find | Replace with | Note |
|---|------|-------------|------|
| 1 | occurs when | happens when | Simpler language |
| 2 | When setting | When you set | Second person + active |
| 3 | When using | When you use | Second person + active |
| 4 | When configuring | When you configure | Second person + active |
| 5 | When creating | When you create | Second person + active |
| 6 | When enabling | When you enable | Second person + active |
| 7 | When running | When you run | Second person + active |
| 8 | the user | you | Address reader directly |
| 9 | users can | you can | Address reader directly |
| 10 | the administrator | you | Address reader directly |
| 11 | the developer | you | Address reader directly |
| 12 | You should use | Use | Imperative mood |
| 13 | You should set | Set | Imperative mood |
| 14 | You should configure | Configure | Imperative mood |

---

## Category 6: Code formatting (2 patterns)

Ensure code elements are formatted correctly in prose.

| # | Find | Note |
|---|------|------|
| 1 | Method names with parentheses in prose (e.g., `getData()` outside a code block) | Use parentheses only inside fenced code blocks. In prose, use inline code without parentheses or reference the method name without `()`. |
| 2 | "See Also" as a section heading | Replace with "Related content" per Microsoft Learn conventions. |

---

## Category 7: Metadata (2 patterns)

Ensure headings and sections follow Microsoft Learn conventions.

| # | Find | Replace with | Note |
|---|------|-------------|------|
| 1 | `## See Also` | `## Related content` | Microsoft Learn heading convention |
| 2 | `## See also` | `## Related content` | Case variation of the same convention |

---

## Pattern count summary

| Category | Count |
|---|---|
| Contractions | 18 |
| Passive voice | 29 |
| Word choice | 18 |
| Future tense | 15 |
| Sentence structure | 14 |
| Code formatting | 2 |
| Metadata | 2 |
| **Total** | **98** |
