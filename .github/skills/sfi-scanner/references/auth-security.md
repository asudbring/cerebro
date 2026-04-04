# Authentication Security Reference

Guidance for identifying and remediating insecure authentication patterns in Azure documentation, aligned with the Secure Future Initiative (SFI).

## Authentication flow hierarchy

Listed from most secure (recommended) to least secure (avoid):

### Recommended flows

| Flow | Security level | Use case |
|---|---|---|
| **Managed identities** | ✅ Most secure | Azure-hosted services authenticating to other Azure resources. No credentials to manage, rotate, or leak. |
| **Workload identity federation** | ✅ Highly secure | External services (GitHub Actions, Kubernetes) authenticating to Azure without secrets. |
| **Certificate-based authentication** | ✅ Secure | Service-to-service authentication using X.509 certificates. |
| **Authorization code flow with PKCE** | ✅ Secure | Interactive user sign-in for web and mobile apps. |
| **Device code flow** | ⚠️ Acceptable | Input-constrained devices (IoT, CLI tools) where a browser isn't available. |

### Not recommended flows

| Flow | Security level | Risk |
|---|---|---|
| **Client secret authentication** | ⚠️ Use with caution | Secrets can leak in logs, source code, or config files. Prefer certificates or managed identities. |
| **Implicit grant flow** | ❌ Not recommended | Access tokens exposed in browser URL fragments. Replaced by authorization code flow with PKCE. |
| **Resource Owner Password Credential (ROPC)** | ❌ Not recommended | Sends username/password directly. Doesn't support MFA, Conditional Access, or federated identity. |

## Detection patterns

### ROPC indicators

Scan for these patterns in code blocks and prose:

- `grant_type=password`
- `resource owner password`
- `ROPC` (as an acronym)
- Username and password variables sent in token requests
- Direct `POST` to `/oauth2/token` with password grant

### Implicit grant indicators

- `response_type=token` (without `code`)
- `implicit grant` or `implicit flow`
- Access tokens returned directly in URL fragments

### Hardcoded credential indicators

- `password = "..."` or `password: "..."` in code blocks
- `client_secret = "..."` assigned directly (not from Key Vault or environment variable)
- API keys as string literals in source code
- Connection strings with embedded passwords

## Remediation guidance

### Replace ROPC with managed identities

**Before (ROPC — not recommended):**

```http
POST /oauth2/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=user@contoso.com&password=P@ssw0rd&client_id=...
```

**After (Managed identity — recommended):**

```python
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://management.azure.com/.default")
```

### Replace client secrets with certificates

**Before (Client secret — use with caution):**

```python
credential = ClientSecretCredential(tenant_id, client_id, client_secret)
```

**After (Certificate — recommended):**

```python
credential = CertificateCredential(tenant_id, client_id, certificate_path)
```

### Secret hygiene

When credentials must be used:

1. **Store in Azure Key Vault** — Never hardcode secrets in source code or configuration files
2. **Rotate regularly** — Set expiration policies and automate rotation
3. **Use environment variables** — Load secrets from environment variables or managed configuration
4. **Revoke on exposure** — Immediately revoke and rotate any credential that is exposed
5. **Audit access** — Monitor Key Vault access logs for unauthorized retrievals

## Standard security disclaimer

Add this disclaimer whenever documenting an insecure authentication flow that cannot be avoided:

```markdown
> [!CAUTION]
> Microsoft recommends the most secure authentication flow available. The authentication
> flow described in this procedure carries risks not present in other flows. Use this flow
> only when more secure flows, such as managed identities, aren't viable.
```

### Placement rules

- Place the disclaimer **before** the first code block that demonstrates the insecure flow
- Use `> [!CAUTION]` alert level (not NOTE or WARNING)
- Include the disclaimer even if the article mentions the risk elsewhere in prose

## Reference links

- [Microsoft identity platform authentication flows](/entra/identity-platform/authentication-flows-app-scenarios)
- [Managed identities for Azure resources](/entra/identity/managed-identities-azure-resources/overview)
- [Workload identity federation](/entra/workload-id/workload-identity-federation)
- [ROPC flow limitations](/entra/identity-platform/v2-oauth-ropc)
- [Implicit grant flow deprecation](/entra/identity-platform/v2-oauth2-implicit-grant-flow)
- [Azure Key Vault](/azure/key-vault/general/overview)
