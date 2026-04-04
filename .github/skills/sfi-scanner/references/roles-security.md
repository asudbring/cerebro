# Roles Security Reference

Guidance for identifying and remediating overly privileged role references in Azure documentation, aligned with the Secure Future Initiative (SFI) and the principle of least privilege.

## Least privilege principle

Every procedure in Azure documentation should instruct the user to sign in with the **minimum role required** for the task. Using Global Administrator when a narrower role suffices:

- Violates the principle of least privilege
- Increases the blast radius of credential compromise
- Teaches users unsafe habits
- Fails SFI compliance review

## Standardized role syntax

When referencing a role in documentation, use this format:

```markdown
Sign in as at least a [Role Name](/entra/identity/role-based-access-control/permissions-reference#role-slug).
```

**Examples:**

```markdown
Sign in as at least a [Application Administrator](/entra/identity/role-based-access-control/permissions-reference#application-administrator).
```

```markdown
Sign in as at least a [Security Administrator](/entra/identity/role-based-access-control/permissions-reference#security-administrator).
```

The slug in the URL is the role name in lowercase with hyphens replacing spaces.

## Common role replacements

When "Global Administrator" is found, suggest the least-privilege alternative based on the task context:

| Task context | Recommended role | Slug |
|---|---|---|
| App registrations, enterprise apps | Application Administrator | `application-administrator` |
| Conditional Access, sign-in policies | Conditional Access Administrator | `conditional-access-administrator` |
| User management, password resets | User Administrator | `user-administrator` |
| Group management | Groups Administrator | `groups-administrator` |
| Security alerts, risk policies | Security Administrator | `security-administrator` |
| Read-only security review | Security Reader | `security-reader` |
| Identity governance, access reviews | Identity Governance Administrator | `identity-governance-administrator` |
| Privileged role assignments | Privileged Role Administrator | `privileged-role-administrator` |
| Authentication methods, MFA | Authentication Administrator | `authentication-administrator` |
| Authentication policies | Authentication Policy Administrator | `authentication-policy-administrator` |
| Directory sync, hybrid identity | Hybrid Identity Administrator | `hybrid-identity-administrator` |
| License management | License Administrator | `license-administrator` |
| Billing, cost management | Billing Administrator | `billing-administrator` |
| Exchange configuration | Exchange Administrator | `exchange-administrator` |
| SharePoint configuration | SharePoint Administrator | `sharepoint-administrator` |
| Teams configuration | Teams Administrator | `teams-administrator` |
| Intune, device management | Intune Administrator | `intune-administrator` |
| Cloud apps, SaaS config | Cloud Application Administrator | `cloud-application-administrator` |

## JIT / PIM recommendations

For tasks that genuinely require elevated access, recommend Just-In-Time (JIT) activation through Privileged Identity Management (PIM):

```markdown
> [!IMPORTANT]
> Microsoft recommends using roles with the fewest permissions. This practice helps improve
> security for your organization. Global Administrator is a highly privileged role that should
> be limited to emergency scenarios when you can't use an existing role.
```

**When to recommend PIM:**

- The task requires a privileged role but is a one-time or infrequent action
- The user needs temporary elevation for a specific operation
- The organization enforces time-bound role assignments

**Standard PIM guidance:**

```markdown
If your organization uses [Privileged Identity Management (PIM)](/entra/id-governance/privileged-identity-management/pim-configure),
activate the [Role Name] role before proceeding.
```

## When highly privileged roles are acceptable

There are limited scenarios where Global Administrator or other highly privileged roles are genuinely required:

- **Break-glass accounts** — Emergency access accounts that bypass Conditional Access policies
- **Initial tenant configuration** — First-time setup of a new Microsoft Entra tenant before role delegation is configured
- **Cross-service operations** — Tasks spanning multiple services where no single narrower role has sufficient permissions
- **PIM configuration** — Setting up PIM itself requires Privileged Role Administrator or Global Administrator

In these cases, document the requirement clearly and add the important note above explaining why the elevated role is needed.

## Reference links

- [Microsoft Entra built-in roles](/entra/identity/role-based-access-control/permissions-reference)
- [Azure built-in roles](/azure/role-based-access-control/built-in-roles)
- [Best practices for Microsoft Entra roles](/entra/identity/role-based-access-control/best-practices)
- [Privileged Identity Management](/entra/id-governance/privileged-identity-management/pim-configure)
- [Least privileged roles by task](/entra/identity/role-based-access-control/delegate-by-task)
