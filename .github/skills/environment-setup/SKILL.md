---
name: environment-setup
description: >-
  First-time setup for Azure documentation workflows. Guides authentication with
  Azure CLI and GitHub CLI, configures Git with correct noreply email, and clones
  documentation repositories with efficient shallow clones. Use when setting up a
  new machine or onboarding a new content developer.
argument-hint: "Describe what to set up: 'set up my environment', 'clone azure-docs-pr', or 'configure git'"
user-invocable: true
---

# Environment setup

Guide for first-time setup of Azure documentation development environment.

## Step 1: Authenticate

Run these commands in your terminal:

```bash
# Azure CLI authentication
az login

# GitHub CLI authentication
gh auth login -s user
```

## Step 2: Verify authentication

```bash
az account show && gh auth status
```

Both commands should succeed without errors.

## Step 3: Configure Git

Extract your GitHub information and configure Git globally:

```bash
# Get GitHub username and ID
GITHUB_USER=$(gh api user --jq '.login')
GITHUB_ID=$(gh api user --jq '.id')

# Configure Git
git config --global user.name "$GITHUB_USER"
git config --global user.email "${GITHUB_ID}+${GITHUB_USER}@users.noreply.github.com"
git config --global core.longpaths true
git config --global core.editor "code --wait"
```

## Step 4: Verify Git configuration

```bash
git config --global user.name
git config --global user.email
```

## Step 5: Clone a documentation repository

### From a Learn URL

If you have a learn.microsoft.com URL:

1. Fetch the page and find the "Edit" link to determine the private repository
2. The private repo name has a `-pr` suffix (e.g., `azure-docs-pr`)
3. The org is typically `MicrosoftDocs`

### From a repository name

If you know the repo name (e.g., `azure-docs-pr`):

```bash
# Create workspace directory
mkdir -p ~/github && cd ~/github

# Fork the repo (if not already forked)
gh repo fork MicrosoftDocs/azure-docs-pr --clone=false

# Shallow clone your fork (saves ~3.9 GB and ~25 minutes for azure-docs-pr)
git clone --depth 5 https://github.com/{YOUR_USERNAME}/azure-docs-pr.git
cd azure-docs-pr

# Add upstream remote
git remote add upstream https://github.com/MicrosoftDocs/azure-docs-pr.git

# Verify remotes
git remote -v
```

### Why shallow clone?

| Approach | Size | Time |
|---|---|---|
| Full clone | ~4.5 GB | ~30 min |
| Shallow clone (--depth 5) | ~600 MB | ~5 min |

Shallow clones contain only recent history. For documentation work, this is sufficient.

## Common repositories

| Repository | Description |
|---|---|
| azure-docs-pr | Azure documentation (private) |
| SupportArticles-docs-pr | Support articles |
| azure-compute-docs-pr | Azure Compute documentation |
| azure-management-docs-pr | Azure Management documentation |

## Troubleshooting

- **"Permission denied"**: Ensure `gh auth login` completed successfully
- **"Repository not found"**: Check you have access to the private repo (-pr suffix)
- **Slow clone**: Use `--depth 5` for shallow clone
- **Long paths error on Windows**: Ensure `git config --global core.longpaths true` is set
