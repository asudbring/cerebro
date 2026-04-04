---
applyTo: "**"
---

# Copilot Custom Instructions — Content Developer Profile

## Copilot customization system

This project uses GitHub's Copilot customization features:

- **`copilot-instructions.md`** — Always-on, repo-wide context (this file)
- **`instructions/*.instructions.md`** — Path-scoped rules auto-applied by file type (`*.md` → markdown authoring + SFI security; `*.yml` → YAML metadata)
- **`agents/*.agent.md`** — Custom agents selectable from the agent dropdown
- **`skills/*/SKILL.md`** — Skills auto-loaded when relevant; each skill has a `SKILL.md` entry point and optional `references/` subdirectory
- **`prompts/*.prompt.md`** — Reusable prompt templates available from the prompt picker
- **`.vscode/mcp.json`** — MCP server configuration

## Identity

You are assisting Allen, an Azure Networking content developer at Microsoft. Primary work involves writing, reviewing, and maintaining documentation on learn.microsoft.com.

Azure Networking services: Virtual Network, VPN Gateway, ExpressRoute, Azure Firewall, Application Gateway, Azure Front Door, Load Balancer, NAT Gateway, Private Link, DNS, Network Watcher, DDoS Protection, Traffic Manager, Virtual WAN, Route Server, Bastion.

## Writing Standards

- Follow the [Microsoft Writing Style Guide](https://learn.microsoft.com/style-guide/welcome/)
- Use active voice, present tense
- Sentence-case headings — capitalize only the first word and proper nouns
- Address the reader directly as "you" in procedures
- Use "select" instead of "click" for UI actions
- Code blocks must include a language identifier (`azurecli`, `azurepowershell`, `json`, `bicep`, etc.)
- **Bold** Azure portal UI elements in procedural steps
- Include a **Prerequisites** section in how-to and quickstart articles

## Documentation Types

Each article type has a specific structure:

- **Quickstart** — get a resource running in minutes
- **How-to** — task-oriented steps for a specific goal
- **Tutorial** — end-to-end learning scenario with multiple steps
- **Concept** — explain what something is and how it works
- **Overview** — introduce a service and its capabilities

Articles follow learn.microsoft.com frontmatter standards (`ms.service`, `ms.topic`, `ms.date`, `ms.author`, `author`, `title`, `description`).

## Tool Preferences

- **Microsoft Learn MCP** — fact-check against official docs
- **Azure DevOps MCP** — work item management
- **GitHub MCP** — PR operations
- **content-developer-assistant MCP** — workflow orchestration (work items, git, PRs)
- **Context7** — library and SDK documentation lookups
- **Cerebro** — personal knowledge retrieval

## Context Mode & AI-Optimized Tools

All agents and skills should use **context-mode** for reading large files and **AI-optimized CLI tools** for search and file operations.

### context-mode MCP tools

| Tool | Purpose |
|---|---|
| `ctx_execute_file` | Process a file in sandbox — only your `print()` output enters context |
| `ctx_index` | Index a file or directory for BM25 full-text search |
| `ctx_search` | Search indexed content with natural language queries |
| `ctx_batch_execute` | Run multiple commands + queries in one call |
| `ctx_execute` | Run shell commands in sandbox without flooding context |
| `ctx_fetch_and_index` | Fetch a URL and index it for search |

### AI-Optimized CLI Tools

| Tool | Command | Use instead of |
|---|---|---|
| ripgrep | `rg` | `grep` |
| fd | `fd` | `find` |
| fzf | `fzf` | Manual list scanning |
| DuckDB | `duckdb` | CSV/JSON data queries |
| git-delta | `delta` | Raw `git diff` |
| xh | `xh` | `curl` |
| watchexec | `watchexec` | Manual polling |
| just | `just` | Shell scripts |
| semgrep | `semgrep` | Manual pattern review |

## CLI Tools Available on All Workstations

### Core Development Tools

| Tool | Command | Purpose |
|---|---|---|
| Git | `git` | Version control |
| Node.js | `node`, `npm`, `npx` | JavaScript runtime and package manager |
| Bun | `bun` | Fast JavaScript runtime and package manager |
| Python | `python`, `pip` | Python runtime and package manager |
| Docker | `docker` | Container management |
| Terraform | `terraform` | Infrastructure as code |
| Bicep | `az bicep` | Azure-native IaC |

### Azure & Cloud CLIs

| Tool | Command | Purpose |
|---|---|---|
| Azure CLI | `az` | Azure resource management |
| Azure PowerShell | `Connect-AzAccount`, `Az` module | Azure management via PowerShell |
| PowerShell | `pwsh` | Cross-platform shell |
| GitHub CLI | `gh` | GitHub operations (PRs, issues, repos) |
| GitHub Copilot CLI | `gh copilot` | AI-assisted CLI commands |

### NPM Global Packages

| Tool | Command | Purpose |
|---|---|---|
| context-mode | `ctx` | Codebase context indexing and search |

## Code and Commands

- Azure CLI: use `az` commands with `--output table` by default
- PowerShell: use `Az` module cmdlets
- Prefer Bicep over ARM JSON templates
- All examples must be copy-pasteable and tested
- Use approved placeholder values:
  - Resource group: `test-rg`
  - Location: `eastus2`
  - Subscription: `00000000-0000-0000-0000-000000000000`
  - Public IPs: `203.0.113.x` (documentation range)
  - Private IPs: `10.0.0.x` or `192.168.0.x`
- When the phrase "push it" is used: stage all changes, commit with a detailed message, run `git pull upstream main --no-edit`, then push to fork.
    - First push to a branch → create a detailed PR using the GitHub MCP tools and the `content-developer` agent (with AB# work item linking)
    - Subsequent pushes → just push to the existing fork branch, no new PR

## Quality Standards

- Every technical claim must be verifiable against official Microsoft documentation
- Include source links when making technical assertions
- Update `ms.date` (format: `MM/DD/YYYY`) when modifying articles
- Scan for sensitive identifiers (GUIDs, IPs, secrets) and replace with approved placeholders
- Never fabricate Azure service limits, SKU details, or pricing — always verify

## Allen's Owned Azure Network Content

- azure-virtual-network
- azure-nat-gateway
- azure-traffic-manager
- azure-dns
- aks-networking
- azure-private-link

## All Azure Networking Service Folders in azure-docs-pr

- application-gateway
- bastion
- cdn
- dns
- expressroute
- firewall
- firewall-manager
- frontdoor
- load-balancer
- nat-gateway
- network-watcher
- networking
- private-link
- route-server
- traffic-manager
- virtual-network\ip-services
- virtual-network-manager
- virtual-wan
- vpn-gateway
- web-application-firewall
