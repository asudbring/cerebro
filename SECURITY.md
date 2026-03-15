# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Cerebro, please report it responsibly.

**Email:** Create a private security advisory on this repository's GitHub Security tab.

## What Counts as a Vulnerability

- Exposed credentials, API keys, or secrets in any file
- SQL injection vectors in schema files or Edge Functions
- Authentication bypass in MCP server access key validation
- Data exfiltration paths in integrations or extensions

## Security Principles

- **No credentials in code.** All secrets use environment variables via Supabase Secrets.
- **Service role only.** The `thoughts` table uses Row Level Security — only the service role key (used by the MCP server) has access.
- **Access key authentication.** Every MCP request requires a valid access key via header (`x-brain-key`) or query parameter (`?key=`).
- **Remote-only MCP.** MCP servers deploy as Supabase Edge Functions — no local servers, no stdio transports.
