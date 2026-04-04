# Sensitive Identifiers — Approved Replacement Values

When documenting Azure services, **never use real GUIDs, secrets, keys, or other sensitive identifiers** in examples. Use these approved placeholder values instead.

## GUID-Format Identifiers

### Application (client) ID — SEV 1

| Replacement value |
|---|
| `00001111-aaaa-2222-bbbb-3333cccc4444` |
| `11112222-bbbb-3333-cccc-4444dddd5555` |
| `22223333-cccc-4444-dddd-5555eeee6666` |
| `33334444-dddd-5555-eeee-6666ffff7777` |
| `44445555-eeee-6666-ffff-7777aaaa8888` |
| `55556666-ffff-7777-aaaa-8888bbbb9999` |
| `66667777-aaaa-8888-bbbb-9999cccc0000` |

### Certificate ID — SEV 0

| Replacement value |
|---|
| `aaaa0a0a-bb1b-cc2c-dd3d-eeeeee4e4e4e` |
| `bbbb1b1b-cc2c-dd3d-ee4e-ffffff5f5f5f` |
| `cccc2c2c-dd3d-ee4e-ff5f-aaaaaa6a6a6a` |
| `dddd3d3d-ee4e-ff5f-aa6a-bbbbbb7b7b7b` |

### Correlation ID — SEV 1

| Replacement value |
|---|
| `aaaa0000-bb11-2222-33cc-444444dddddd` |
| `bbbb1111-cc22-3333-44dd-555555eeeeee` |
| `cccc2222-dd33-4444-55ee-666666ffffff` |

### Directory (tenant) ID — SEV 1

| Replacement value |
|---|
| `aaaabbbb-0000-cccc-1111-dddd2222eeee` |
| `bbbbcccc-1111-dddd-2222-eeee3333ffff` |
| `ccccdddd-2222-eeee-3333-ffff4444aaaa` |
| `ddddeeee-3333-ffff-4444-aaaa5555bbbb` |
| `eeeeffff-4444-aaaa-5555-bbbb6666cccc` |
| `ffffaaaa-5555-bbbb-6666-cccc7777dddd` |
| `aaaabbbb-6666-cccc-7777-dddd8888eeee` |

### Object ID — SEV 1

| Replacement value |
|---|
| `aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb` |
| `bbbbbbbb-1111-2222-3333-cccccccccccc` |
| `cccccccc-2222-3333-4444-dddddddddddd` |
| `dddddddd-3333-4444-5555-eeeeeeeeeeee` |
| `eeeeeeee-4444-5555-6666-ffffffffffff` |
| `ffffffff-5555-6666-7777-aaaaaaaaaaaa` |
| `aaaaaaaa-6666-7777-8888-bbbbbbbbbbbb` |

### Organization ID — SEV 1

| Replacement value |
|---|
| `aaaa0000-bb11-2222-33cc-444444dddddd` |
| `bbbb1111-cc22-3333-44dd-555555eeeeee` |

### Principal ID — SEV 2

| Replacement value |
|---|
| `aaaa0a0a-bb1b-cc2c-dd3d-eeeeee4e4e4e` |
| `bbbb1b1b-cc2c-dd3d-ee4e-ffffff5f5f5f` |
| `cccc2c2c-dd3d-ee4e-ff5f-aaaaaa6a6a6a` |

### Resource ID — SEV 1

| Replacement value |
|---|
| `/subscriptions/aaaa0a0a-bb1b-cc2c-dd3d-eeeeee4e4e4e/resourceGroups/myResourceGroup` |
| `/subscriptions/bbbb1b1b-cc2c-dd3d-ee4e-ffffff5f5f5f/resourceGroups/myResourceGroup` |

### Secret ID — SEV 0

| Replacement value |
|---|
| `aaaa0a0a-bb1b-cc2c-dd3d-eeeeee4e4e4e` |
| `bbbb1b1b-cc2c-dd3d-ee4e-ffffff5f5f5f` |

### Subscription ID — SEV 1

| Replacement value |
|---|
| `aaaa0a0a-bb1b-cc2c-dd3d-eeeeee4e4e4e` |
| `bbbb1b1b-cc2c-dd3d-ee4e-ffffff5f5f5f` |
| `cccc2c2c-dd3d-ee4e-ff5f-aaaaaa6a6a6a` |
| `dddd3d3d-ee4e-ff5f-aa6a-bbbbbb7b7b7b` |
| `eeee4e4e-ff5f-aa6a-bb7b-cccccc8c8c8c` |

### Trace ID — SEV 2

| Replacement value |
|---|
| `aaaa0000-bb11-2222-33cc-444444dddddd` |
| `bbbb1111-cc22-3333-44dd-555555eeeeee` |

## Non-GUID Sensitive Identifiers

### Client Secret — SEV 0

| Replacement value |
|---|
| `abc8Q~defGHIjklMNOpqrSTUVwxyz0123456789` |
| `rst7Q~uvWXYZabcdEFGH1234ijklMNOP5678` |

### Alphanumeric Secret — SEV 0

| Replacement value |
|---|
| `A1b2C3d4E5f6G7h8I9j0` |
| `K1l2M3n4O5p6Q7r8S9t0` |

### Certificate Thumbprint / Hash — SEV 0

| Replacement value |
|---|
| `A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2` |
| `B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3` |

### Signature Hash — SEV 0

| Replacement value |
|---|
| `A1bC2dE3fH4iJ5kL6mN7oP8qR9sT0u` |
| `V1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0o` |

## Severity Levels

| Severity | Description | Action |
|---|---|---|
| SEV 0 | Secret value — immediate exposure risk | Block publication until replaced |
| SEV 1 | Identifying GUID — can be used to target resources | Must be replaced before publication |
| SEV 2 | Low-risk identifier — limited exposure | Should be replaced; may pass review with justification |

## Usage Guidelines

1. **Always use approved replacement values** from the tables above when writing examples
2. **Use different values** for different entities in the same article (don't reuse the same GUID for both tenant ID and application ID)
3. **Add comments** in code samples indicating these are example values: `# Replace with your actual subscription ID`
4. **Resource names** in examples should use generic patterns: `myResourceGroup`, `myVirtualNetwork`, `myLoadBalancer`
5. **IP addresses** in examples should use documentation ranges: `192.0.2.0/24` (TEST-NET-1), `198.51.100.0/24` (TEST-NET-2), `203.0.113.0/24` (TEST-NET-3)
