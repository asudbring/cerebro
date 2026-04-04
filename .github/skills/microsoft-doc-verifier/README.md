# Microsoft Documentation Verifier

A VS Code Copilot skill that fact-checks Microsoft documentation against official sources across **all product areas** — Azure, Microsoft 365, Microsoft Security, Power Platform, Dynamics 365, Windows, Developer Tools, and more.

Generates structured reports with per-file findings, source citations, accuracy classifications, and fix recommendations.

---

## Prerequisites

### Required

| Requirement | How to verify |
|-------------|---------------|
| **VS Code** (1.100+) | `code --version` |
| **GitHub Copilot extension** | Extensions panel → search "GitHub Copilot" → must show installed and signed in |
| **GitHub Copilot Chat** | Extensions panel → search "GitHub Copilot Chat" → must show installed |
| **Agent mode enabled** | Copilot Chat → click the mode dropdown → "Agent" should be available |
| **Microsoft Learn MCP Server** | Check `%APPDATA%\Code\User\mcp.json` or `.vscode/mcp.json` for `microsoft-learn-mcp-server` entry |

### Optional (for PR workflows)

| Requirement | How to verify |
|-------------|---------------|
| **GitHub MCP Server** | Check MCP config for `github` server entry |
| **GitHub CLI** | `gh --version` |
| **GitHub authentication** | `gh auth status` |

---

## Installation

### 1. Copy the skill folder

Copy the entire `microsoft-doc-verifier/` folder to your Copilot skills directory:

**Windows:**
```powershell
Copy-Item -Recurse .\microsoft-doc-verifier\ "$env:USERPROFILE\.copilot\skills\microsoft-doc-verifier"
```

**macOS / Linux:**
```bash
cp -r ./microsoft-doc-verifier/ ~/.copilot/skills/microsoft-doc-verifier/
```

### 2. Verify the folder structure

```
~/.copilot/skills/microsoft-doc-verifier/
├── SKILL.md                          # Skill definition (Copilot reads this)
├── README.md                         # This file
└── assets/
    ├── single-article-check.prompt.md   # Workflow 1: Single article
    ├── batch-report.prompt.md           # Workflow 2: Batch report
    ├── pr-review.prompt.md              # Workflow 3: PR review
    └── research-only.prompt.md          # Workflow 4: Research
```

### 3. Restart VS Code

The skill is loaded on startup. After restarting, Copilot automatically discovers it.

---

## Usage

Open **GitHub Copilot Chat** in agent mode and describe what you want verified. The agent automatically selects the right workflow and asks clarifying questions to scope the verification.

### What triggers this skill

The skill activates when your prompt matches patterns like:

| You say... | Workflow triggered |
|-----------|-------------------|
| "Fact-check this article" | Single Article Check |
| "Verify this Defender for Endpoint article" | Single Article Check |
| "Fact-check these files" | Batch Report |
| "Check the docs in this folder for accuracy" | Batch Report |
| "Fact-check PR #12345" | PR Review |
| "Review this pull request for technical accuracy" | PR Review |
| "Research Microsoft Sentinel data connectors" | Research Only |
| "What does the official documentation say about Intune compliance policies?" | Research Only |

### Trigger keywords

Any combination of these words in your prompt will invoke the skill:

- **Actions**: fact-check, verify, validate, audit, review accuracy, check claims
- **Targets**: article, documentation, docs, file, folder, PR, pull request
- **Qualifiers**: technical accuracy, against official sources, against Microsoft Learn

---

## Examples

### Example 1 — Fact-check a single article

**You**: "Fact-check this article about Microsoft Defender for Endpoint onboarding"

**Agent asks**: 
> I see this covers Microsoft Security / Defender for Endpoint. Should I do a quick check or thorough verification?

**You**: "Thorough"

**Result**: Agent verifies every claim against learn.microsoft.com, edits the file with corrections, and summarizes findings in chat with source URLs.

---

### Example 2 — Fact-check a PR

**You**: "Load PR #313172 and fact-check against public documentation"

**Agent asks**:
> This PR has 24 files covering Azure networking (DDoS Protection, Azure Firewall, WAF). Should I generate a standalone report?

**You**: "Yes, generate a report"

**Result**: Agent reads all changed files, verifies each technical claim, and generates `factcheck_PR313172.md` with:
- Executive summary
- Critical findings (inaccuracies, broken links)
- Per-file verification table
- Sources consulted with tier classifications

---

### Example 3 — Fact-check a folder of M365 Security docs

**You**: "Verify all the markdown files in articles/defender-for-endpoint/onboarding/ for technical accuracy"

**Agent asks**:
> These docs cover Microsoft Defender for Endpoint onboarding. I'll search learn.microsoft.com under `/defender-endpoint/` paths. Do you want corrections applied to the files, a standalone report, or both?

**You**: "Just a report"

**Result**: Agent scans every `.md` file in the folder, cross-references claims against official Defender docs, and generates a batch report.

---

### Example 4 — Research a topic

**You**: "Research Microsoft Purview sensitivity labels — what are the current capabilities and limits?"

**Agent asks**:
> I'll search across Microsoft Purview and Microsoft 365 compliance documentation. Do you want output in chat, as a file, or both?

**You**: "Both"

**Result**: Agent searches learn.microsoft.com, fetches full pages, and produces a research report with inline citations and a sources table.

---

## How it works

```
┌──────────────────────────────────────────────┐
│  You describe what to verify                 │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Step 0: Scope the verification              │
│  • Product area (Azure, M365, Security, ...) │
│  • Service/feature focus                     │
│  • Single file, folder, or PR?               │
│  • Output preference                         │
│  • Depth (quick or thorough)                 │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Step 1: Extract claims                      │
│  • Product names, features, limits           │
│  • CLI/API commands, code examples           │
│  • SKU requirements, pricing, availability   │
│  • Preview/GA/deprecated status              │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Step 2: Verify against sources              │
│  • Tier 1: learn.microsoft.com (primary)     │
│  • Tier 2: techcommunity, devblogs, GitHub   │
│  • Tier 3: developer.microsoft.com           │
│  • Tier 4: MS Q&A, Stack Overflow (MS only)  │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Step 3: Classify each claim                 │
│  ✅ Accurate     ⚠️ Partially accurate       │
│  ❌ Inaccurate   🕐 Outdated                 │
│  ❓ Unverifiable  🔗 Broken link             │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Step 4: Output                              │
│  • In-place edits (Workflow 1)               │
│  • Standalone report (Workflows 2 & 3)       │
│  • Research report (Workflow 4)              │
└──────────────────────────────────────────────┘
```

---

## Supported product areas

| Product area | Example services |
|-------------|-----------------|
| **Azure** | Azure Firewall, DDoS Protection, App Service, AKS, Cosmos DB |
| **Microsoft 365** | Exchange Online, SharePoint, Teams, OneDrive, Outlook |
| **Microsoft Security** | Defender for Endpoint, Defender for Cloud, Sentinel, Entra ID, Purview, Intune |
| **Power Platform** | Power Apps, Power Automate, Power BI, Dataverse |
| **Dynamics 365** | Business Central, Finance, Supply Chain, Customer Service |
| **Windows** | Windows 11, Windows Server, Group Policy, WSUS |
| **Developer Tools** | Visual Studio, .NET, Azure DevOps, GitHub Actions |

---

## Accuracy classifications

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Accurate | Matches current official documentation |
| ⚠️ | Partially accurate | Mostly correct but needs minor update or missing context |
| ❌ | Inaccurate | Contradicts official sources |
| 🕐 | Outdated | Was correct but has been superseded |
| ❓ | Unverifiable | No authoritative source found (flagged, not removed) |
| 🔗 | Broken link | URL doesn't resolve or anchor is missing |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Skill not recognized | Verify folder is at `~/.copilot/skills/microsoft-doc-verifier/` with `SKILL.md` inside. Restart VS Code. |
| "microsoft_docs_search" not available | Check MCP config for Microsoft Learn MCP Server entry. Restart VS Code. |
| PR workflow can't load PR | Ensure GitHub MCP Server is configured and `gh auth status` shows authenticated. |
| Agent doesn't ask scoping questions | Add context to your prompt: "fact-check this M365 Security article about Defender for Endpoint" |
| Report not generated | Specify output preference: "generate a standalone report" |

---

## Related skills

| Skill | Focus |
|-------|-------|
| `fact-checker` | Azure-only verification with 7 specialized workflows (quick fix, full report, internal+public, freshness, deep agent, research, CIA) |
| `microsoft-doc-verifier` | All Microsoft products, simplified 4-workflow model, interactive scoping (this skill) |
