# Approved Identifiers for SFI Compliance

Pre-approved dummy values for use in Azure documentation. When a sensitive identifier is detected during scanning, replace it with the corresponding approved placeholder from this list.

## Severity ratings

| SEV | Meaning | Examples |
|---|---|---|
| 0 | **Most sensitive** — Immediate security risk if exposed | Client secrets, certificate IDs, thumbprints, signature hashes |
| 1 | **Sensitive** — Can be used to identify or target resources | Tenant IDs, subscription IDs, client IDs, object IDs |
| 2 | **Least sensitive** — Limited risk but should still use placeholders | Trace IDs, correlation IDs, principal IDs |

---

## GUID types

### Application (Client) ID — SEV 1

| # | Approved value |
|---|---|
| 1 | 00001111-aaaa-2222-bbbb-3333cccc4444 |
| 2 | 11112222-bbbb-3333-cccc-4444dddd5555 |
| 3 | 22223333-cccc-4444-dddd-5555eeee6666 |
| 4 | 33334444-dddd-5555-eeee-6666ffff7777 |
| 5 | 44445555-eeee-6666-ffff-7777aaaa8888 |
| 6 | 55556666-ffff-7777-aaaa-8888bbbb9999 |
| 7 | 66667777-aaaa-8888-bbbb-9999cccc0000 |

### Certificate ID — SEV 0

| # | Approved value |
|---|---|
| 1 | 0a0a0a0a-1111-bbbb-2222-3c3c3c3c3c3c |
| 2 | 1b1b1b1b-2222-cccc-3333-4d4d4d4d4d4d |
| 3 | 2c2c2c2c-3333-dddd-4444-5e5e5e5e5e5e |
| 4 | 3d3d3d3d-4444-eeee-5555-6f6f6f6f6f6f |
| 5 | 4e4e4e4e-5555-ffff-6666-7a7a7a7a7a7a |
| 6 | 5f5f5f5f-6666-aaaa-7777-8b8b8b8b8b8b |
| 7 | 6a6a6a6a-7777-bbbb-8888-9c9c9c9c9c9c |

### Correlation ID — SEV 1

| # | Approved value |
|---|---|
| 1 | aaaa0000-bb11-2222-33cc-444444dddddd |
| 2 | bbbb1111-cc22-3333-44dd-555555eeeeee |
| 3 | cccc2222-dd33-4444-55ee-666666ffffff |
| 4 | dddd3333-ee44-5555-66ff-777777aaaaaa |
| 5 | eeee4444-ff55-6666-77aa-888888bbbbbb |
| 6 | ffff5555-aa66-7777-88bb-999999cccccc |
| 7 | aaaa6666-bb77-8888-99cc-000000dddddd |

### Directory (Tenant) ID — SEV 1

| # | Approved value |
|---|---|
| 1 | aaaabbbb-0000-cccc-1111-dddd2222eeee |
| 2 | bbbbcccc-1111-dddd-2222-eeee3333ffff |
| 3 | ccccdddd-2222-eeee-3333-ffff4444aaaa |
| 4 | ddddeeee-3333-ffff-4444-aaaa5555bbbb |
| 5 | eeeeffff-4444-aaaa-5555-bbbb6666cccc |
| 6 | ffffaaaa-5555-bbbb-6666-cccc7777dddd |
| 7 | aaaabbbb-6666-cccc-7777-dddd8888eeee |

### Object ID — SEV 1

| # | Approved value |
|---|---|
| 1 | aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb |
| 2 | bbbbbbbb-1111-2222-3333-cccccccccccc |
| 3 | cccccccc-2222-3333-4444-dddddddddddd |
| 4 | dddddddd-3333-4444-5555-eeeeeeeeeeee |
| 5 | eeeeeeee-4444-5555-6666-ffffffffffff |
| 6 | ffffffff-5555-6666-7777-aaaaaaaaaaaa |
| 7 | aaaaaaaa-6666-7777-8888-bbbbbbbbbbbb |

### Organization / Entity / User ID — SEV 1

| # | Approved value |
|---|---|
| 1 | 00aa00aa-bb11-cc22-dd33-44ee44ee44ee |
| 2 | 11bb11bb-cc22-dd33-ee44-55ff55ff55ff |
| 3 | 22cc22cc-dd33-ee44-ff55-66aa66aa66aa |
| 4 | 33dd33dd-ee44-ff55-aa66-77bb77bb77bb |
| 5 | 44ee44ee-ff55-aa66-bb77-88cc88cc88cc |
| 6 | 55ff55ff-aa66-bb77-cc88-99dd99dd99dd |
| 7 | 66aa66aa-bb77-cc88-dd99-00ee00ee00ee |

### Principal ID — SEV 2

| # | Approved value |
|---|---|
| 1 | aaaaaaaa-bbbb-cccc-1111-222222222222 |
| 2 | bbbbbbbb-cccc-dddd-2222-333333333333 |
| 3 | cccccccc-dddd-eeee-3333-444444444444 |
| 4 | dddddddd-eeee-ffff-4444-555555555555 |
| 5 | eeeeeeee-ffff-aaaa-5555-666666666666 |
| 6 | ffffffff-aaaa-bbbb-6666-777777777777 |
| 7 | aaaaaaaa-bbbb-cccc-7777-888888888888 |

### Resource ID — SEV 1

| # | Approved value |
|---|---|
| 1 | a0a0a0a0-bbbb-cccc-dddd-e1e1e1e1e1e1 |
| 2 | b1b1b1b1-cccc-dddd-eeee-f2f2f2f2f2f2 |
| 3 | c2c2c2c2-dddd-eeee-ffff-a3a3a3a3a3a3 |
| 4 | d3d3d3d3-eeee-ffff-aaaa-b4b4b4b4b4b4 |
| 5 | e4e4e4e4-ffff-aaaa-bbbb-c5c5c5c5c5c5 |
| 6 | f5f5f5f5-aaaa-bbbb-cccc-d6d6d6d6d6d6 |
| 7 | a6a6a6a6-bbbb-cccc-dddd-e7e7e7e7e7e7 |

### Secret ID / Key ID — SEV 0

| # | Approved value |
|---|---|
| 1 | aaaaaaaa-0b0b-1c1c-2d2d-333333333333 |
| 2 | bbbbbbbb-1c1c-2d2d-3e3e-444444444444 |
| 3 | cccccccc-2d2d-3e3e-4f4f-555555555555 |
| 4 | dddddddd-3e3e-4f4f-5a5a-666666666666 |
| 5 | eeeeeeee-4f4f-5a5a-6b6b-777777777777 |
| 6 | ffffffff-5a5a-6b6b-7c7c-888888888888 |
| 7 | aaaaaaaa-6b6b-7c7c-8d8d-999999999999 |

### Subscription ID — SEV 1

| # | Approved value |
|---|---|
| 1 | aaaa0a0a-bb1b-cc2c-dd3d-eeeeee4e4e4e |
| 2 | bbbb1b1b-cc2c-dd3d-ee4e-ffffff5f5f5f |
| 3 | cccc2c2c-dd3d-ee4e-ff5f-aaaaaa6a6a6a |
| 4 | dddd3d3d-ee4e-ff5f-aa6a-bbbbbb7b7b7b |
| 5 | eeee4e4e-ff5f-aa6a-bb7b-cccccc8c8c8c |
| 6 | ffff5f5f-aa6a-bb7b-cc8c-dddddd9d9d9d |
| 7 | aaaa6a6a-bb7b-cc8c-dd9d-eeeeee0e0e0e |

### Trace ID — SEV 2

| # | Approved value |
|---|---|
| 1 | 0000aaaa-11bb-cccc-dd22-eeeeee333333 |
| 2 | 1111bbbb-22cc-dddd-ee33-ffffff444444 |
| 3 | 2222cccc-33dd-eeee-ff44-aaaaaa555555 |
| 4 | 3333dddd-44ee-ffff-aa55-bbbbbb666666 |
| 5 | 4444eeee-55ff-aaaa-bb66-cccccc777777 |
| 6 | 5555ffff-66aa-bbbb-cc77-dddddd888888 |
| 7 | 6666aaaa-77bb-cccc-dd88-eeeeee999999 |

---

## Non-GUID types

### Client Secret — SEV 0

| # | Approved value |
|---|---|
| 1 | Aa1Bb~2Cc3.-Dd4Ee5Ff6Gg7Hh8Ii9_Jj0Kk1Ll2 |
| 2 | Bb2Cc~3Dd4.-Ee5Ff6Gg7Hh8Ii9Jj0_Kk1Ll2Mm3 |
| 3 | Cc3Dd~4Ee5.-Ff6Gg7Hh8Ii9Jj0Kk1_Ll2Mm3Nn4 |
| 4 | Dd4Ee~5Ff6.-Gg7Hh8Ii9Jj0Kk1Ll2_Mm3Nn4Oo5 |
| 5 | Ee5Ff~6Gg7.-Hh8Ii9Jj0Kk1Ll2Mm3_Nn4Oo5Pp6 |
| 6 | Ff6Gg~7Hh8.-Ii9Jj0Kk1Ll2Mm3Nn4_Oo5Pp6Qq7 |
| 7 | Gg7Hh~8Ii9.-Jj0Kk1Ll2Mm3Nn4Oo5_Pp6Qq7Rr8 |

### Alphanumeric Value — SEV 0

| # | Approved value |
|---|---|
| 1 | A1bC2dE3fH4iJ5kL6mN7oP8qR9sT0u |
| 2 | B2cD3eF4gI5jK6lM7nO8pQ9rS0tU1v |
| 3 | C3dE4fG5hJ6kL7mN8oP9qR0sT1uV2w |
| 4 | D4eF5gH6iK7lM8nO9pQ0rS1tU2vW3x |
| 5 | E5fG6hI7jL8mN9oP0qR1sT2uV3wX4y |
| 6 | F6gH7iJ8kM9nO0pQ1rS2tU3vW4xY5z |
| 7 | G7hI8jK9lN0oP1qR2sT3uV4wX5yZ6a |

### Thumbprint / Hash — SEV 0

| # | Approved value |
|---|---|
| 1 | AA11BB22CC33DD44EE55FF66AA77BB88CC99DD00 |
| 2 | BB22CC33DD44EE55FF66AA77BB88CC99DD00EE11 |
| 3 | CC33DD44EE55FF66AA77BB88CC99DD00EE11FF22 |
| 4 | DD44EE55FF66AA77BB88CC99DD00EE11FF22AA33 |
| 5 | EE55FF66AA77BB88CC99DD00EE11FF22AA33BB44 |
| 6 | FF66AA77BB88CC99DD00EE11FF22AA33BB44CC55 |
| 7 | AA77BB88CC99DD00EE11FF22AA33BB44CC55DD66 |

### Signature Hash — SEV 0

| # | Approved value |
|---|---|
| 1 | aB1cD2eF-3gH4iJ5kL6-mN7oP8qR= |
| 2 | bC2dE3fG-4hI5jK6lM7-nO8pQ9rS= |
| 3 | cD3eF4gH-5iJ6kL7mN8-oP9qR0sT= |
| 4 | dE4fG5hI-6jK7lM8nO9-pQ0rS1tU= |
| 5 | eF5gH6iJ-7kL8mN9oP0-qR1sT2uV= |
| 6 | fG6hI7jK-8lM9nO0pQ1-rS2tU3vW= |
| 7 | gH7iJ8kL-9mN0oP1qR2-sT3uV4wX= |

---

## Usage notes

- When replacing a sensitive identifier, choose the approved value that matches the **type** of the original identifier (e.g., use a Tenant ID placeholder for a detected tenant ID).
- Rotate through the numbered values (1–7) when a single document needs multiple distinct placeholders of the same type.
- If an identifier is already on this list, classify it as **Placeholder** (compliant) and skip it.
- If an identifier is partially masked (e.g., `abcd****-****-****-****-****efgh1234`), classify it as **Obfuscated** (acceptable) and skip it.
