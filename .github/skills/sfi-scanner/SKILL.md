---
name: sfi-scanner
description: >-
  Scan Azure documentation for Secure Future Initiative (SFI) compliance issues.
  Detects Global Administrator role references, insecure authentication flows (ROPC),
  and sensitive identifiers (GUIDs, secrets, keys) in both text and images. Provides
  remediation guidance and generates compliance reports.
argument-hint: "Describe what to scan: 'scan for sensitive GUIDs', 'check roles in this article', 'SFI compliance review', or 'scan images for secrets'"
user-invocable: true
---

# SFI Scanner

Scan Azure documentation for Secure Future Initiative (SFI) compliance issues. This skill detects overly privileged role references, insecure authentication patterns, and sensitive identifiers in both markdown text and screenshots.

## Scan categories

### 1. Global Administrator (GA) roles detection

Scan for references to "Global Administrator" or other overly privileged roles that violate the principle of least privilege.

**What to detect:**

- Explicit mentions of "Global Administrator" or "Global Admin"
- References to other overly privileged roles when a narrower role exists
- Instructions that tell users to sign in with Global Administrator without justification
- Role references that lack the standardized syntax format

**Remediation guidance:**

- Suggest the least-privilege alternative role for the task (e.g., Application Administrator, Security Administrator, User Administrator)
- Recommend Just-In-Time (JIT) access via Privileged Identity Management (PIM) for temporary elevation
- Use the standardized syntax: `Sign in as at least a [Role Name](/entra/identity/role-based-access-control/permissions-reference#role-slug)`
- Document exceptions where highly privileged roles are genuinely required (break-glass scenarios, one-time tenant configuration)

See [references/roles-security.md](references/roles-security.md) for the complete least-privilege role mapping and guidance.

### 2. ROPC authentication detection

Scan for Resource Owner Password Credential (ROPC) flows and other insecure authentication patterns.

**What to detect:**

- `grant_type=password` in code samples or URLs
- ROPC flow references or descriptions
- Hardcoded credentials (usernames/passwords in code blocks)
- Implicit Grant flow references (`response_type=token`)
- Client secrets embedded directly in code (not loaded from Key Vault or environment variables)

**Remediation guidance:**

- Recommend managed identities as the preferred authentication method (no credential management required)
- Suggest Azure Key Vault for secret storage when credentials are necessary
- Add the standard security disclaimer when insecure flows must be documented
- Recommend certificate-based authentication over client secrets

See [references/auth-security.md](references/auth-security.md) for secure authentication patterns and the standard disclaimer template.

### 3. Sensitive identifiers (GUIDs) detection

Scan for real or potentially real GUIDs, tenant IDs, client IDs, secrets, and thumbprints that should be replaced with approved placeholders.

**What to detect:**

- GUIDs in standard format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- Tenant IDs, client IDs, subscription IDs, object IDs
- Client secrets and API keys
- Certificate thumbprints and signature hashes
- Alphanumeric tokens that resemble credentials

**Classification:**

Each found identifier is classified into one of three states:

| State | Description | Action |
|---|---|---|
| **Visible** | A real or potentially real identifier exposed in text | Must be replaced with an approved placeholder |
| **Placeholder** | An identifier from the approved list | No action needed — already compliant |
| **Obfuscated** | An identifier that is partially masked (e.g., `abcd****-****-****-****-****efgh1234`) | Acceptable — no action needed |

Cross-reference all found identifiers against the approved list in [references/approved-identifiers.md](references/approved-identifiers.md). Only flag identifiers that are NOT on the approved list and NOT obfuscated.

### 4. Image scanning

Scan screenshots and images referenced in markdown for sensitive information.

**Workflow:**

1. Parse the markdown file for image references using the Microsoft Learn image syntax:
   ```markdown
   :::image type="content" source="media/filename.png" alt-text="Description":::
   ```
2. Also detect standard markdown image syntax: `![alt](path)`
3. For each image found, use vision analysis to detect:
   - GUIDs or UUID-format strings visible in the screenshot
   - Role names (especially "Global Administrator") in portal UI
   - Secrets, keys, or tokens visible in configuration panels
   - Subscription IDs, tenant IDs, or resource IDs in address bars or properties panels
4. **Do NOT convert images to base64** — analyze attached images directly using vision capabilities
5. Report findings per image with the visual location described (e.g., "visible in the Properties panel", "shown in the address bar")

## Report template

```
# SFI Compliance Report

## Summary
- Files scanned: N
- Issues found: N (Critical: N, Warning: N, Info: N)
- Images scanned: N
- Image issues found: N

## Severity levels
- **Critical (SEV 0)**: Client secrets, certificate IDs, thumbprints exposed in text or images
- **Warning (SEV 1)**: GUIDs (tenant/client/subscription IDs), GA role references, ROPC flows
- **Info (SEV 2)**: Minor identifier exposure, role suggestions, style recommendations

## Findings by file

### path/to/file.md

#### GA Roles
- Line N: "Global Administrator" → Suggest "Application Administrator" (SEV 1)
  - Remediation: `Sign in as at least a [Application Administrator](/entra/identity/role-based-access-control/permissions-reference#application-administrator)`

#### ROPC / Insecure Auth
- Line N: `grant_type=password` detected → Add security disclaimer, recommend managed identity (SEV 1)

#### Sensitive Identifiers
- Line N: GUID `a1b2c3d4-e5f6-7890-abcd-ef1234567890` → State: Visible (SEV 1)
  - Replace with approved placeholder: `aaaabbbb-0000-cccc-1111-dddd2222eeee` (Directory/Tenant ID)

#### Image Findings
- `media/portal-config.png`: GUID visible in Properties panel → Replace screenshot (SEV 1)
- `media/role-assignment.png`: "Global Administrator" visible in role picker → Update screenshot (SEV 1)
```

## Orchestration workflow

Follow these steps when executing a scan:

1. **Request/identify files to scan** — Accept a file path, folder path, or PR reference. If a folder, recursively find all `.md` files.

2. **Read file content** — Load each markdown file with line numbers for reference.

3. **Parse markdown for image references** — Extract all image paths from `:::image` and `![]()` syntax.

4. **Run text-based scans** — For each file, scan for:
   - GA role references (Category 1)
   - ROPC and insecure auth patterns (Category 2)
   - Sensitive identifiers (Category 3)

5. **Cross-reference against approved identifiers** — Compare found GUIDs and secrets against the approved list in [references/approved-identifiers.md](references/approved-identifiers.md). Classify each as Visible, Placeholder, or Obfuscated.

6. **Run vision analysis on images** — For each referenced image that can be accessed, analyze for sensitive content (Category 4).

7. **Generate report** — Compile all findings into the structured report format above, sorted by severity.
