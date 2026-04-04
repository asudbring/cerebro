# Claude Code — Content Developer Profile

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

### AI-Optimized Dev Tools

| Tool | Command | Purpose |
|---|---|---|
| ripgrep | `rg` | Fast grep that respects .gitignore |
| fd | `fd` | Modern `find` replacement |
| fzf | `fzf` | Interactive fuzzy finder |
| DuckDB | `duckdb` | SQL on CSV/Parquet/JSON files |
| git-delta | `delta` | Better git diff output |
| xh | `xh` | Structured HTTP client output |
| watchexec | `watchexec` | Auto-rerun commands on file changes |
| just | `just` | Simple task runner |
| semgrep | `semgrep` | Static code analysis |

### NPM Global Packages

| Tool | Command | Purpose |
|---|---|---|
| context-mode | `ctx` | Codebase context indexing and search |

### OS-Specific Tools

- **Windows**: `winget`, `choco` (Chocolatey), Windows Terminal, WSL with Ubuntu
- **macOS**: `brew` (Homebrew), oh-my-zsh
- **Linux**: Terminator, oh-my-bash, KVM/QEMU (virt-manager), FreeRDP, Flameshot

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
