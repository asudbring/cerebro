---
applyTo: "**/*.md"
---

# Secure Future Initiative (SFI) guidelines

These guidelines apply to all Azure documentation markdown files.

## Least privilege roles

- Avoid recommending **Owner**, **Global Administrator**, or **Contributor** roles unless absolutely necessary
- Identify the minimum role required for each task
- Use standardized role reference syntax:
  ```markdown
  Sign in as at least a [Security Administrator](/entra/identity/role-based-access-control/permissions-reference#security-administrator)
  ```
- Recommend just-in-time (JIT) access via Microsoft Entra Privileged Identity Management (PIM) for temporary elevation
- When highly privileged roles are necessary (break-glass, one-time setup), include a clear disclaimer about using JIT/PIM

## Authentication flows

- **Recommend managed identities** as the primary authentication method — no credential management required
- **Do not recommend** Resource Owner Password Credentials (ROPC) flows for production use
- **Do not recommend** Implicit Grant flows — migrate to Authorization Code flow with PKCE
- When documenting less secure flows (ROPC, client secrets), include this disclaimer:

  > [!IMPORTANT]
  > Microsoft recommends the most secure authentication flow available. This flow carries risks not present in other flows. Use only when more secure flows, such as managed identities, aren't viable.

## Secret hygiene

- Store secrets in Azure Key Vault
- Recommend regular rotation on any compromise indication
- Recommend immediate revocation on team member changes
- Use managed identities to access Key Vault when possible

## Sensitive identifiers

- Never include real GUIDs, tenant IDs, client IDs, secrets, or thumbprints in documentation
- Use pre-approved placeholder values (see the sfi-scanner skill for the approved list)
- Use approved documentation IP ranges: `203.0.113.x` (public), `10.0.0.x` or `192.168.0.x` (private)
- Use placeholder subscription ID: `00000000-0000-0000-0000-000000000000`
