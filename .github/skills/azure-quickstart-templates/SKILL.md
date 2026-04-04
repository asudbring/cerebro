---
name: azure-quickstart-templates
description: "Review, validate, or create Azure Quickstart Templates following the Azure/azure-quickstart-templates contribution guide. Covers file structure, naming, Bicep/JSON authoring, metadata, README, parameters, best practices, and CI validation rules."
argument-hint: "Describe the task, e.g. 'review this quickstart template for compliance' or 'create a new quickstart for Azure Storage with Bicep'"
user-invocable: true
---

# Azure Quickstart Templates — Contribution & Authoring Skill

Use this skill when **reviewing**, **validating**, or **creating** templates for the [Azure/azure-quickstart-templates](https://github.com/Azure/azure-quickstart-templates) repository.

## When to Use

- Creating a new quickstart template (Bicep or JSON)
- Reviewing an existing template for contribution-guide compliance
- Validating file structure, naming, metadata, README, and parameters
- Converting a JSON template to Bicep
- Preparing a PR for the azure-quickstart-templates repo

---

## 1. Folder Structure & Naming

### Required Folder Placement

Every sample must be in a subfolder under one of these top-level directories:

| Directory | Purpose |
|---|---|
| **application-workloads/** | Full application workloads ready for production use |
| **demos/** | Demonstrate a capability of the Azure platform |
| **managementgroup-deployments/** | Templates deployed at management group scope |
| **modules/** | Reusable templates/modules for common resources |
| **quickstarts/** | Quick-provision templates for evaluating infrastructure |
| **subscription-deployments/** | Templates deployed at subscription scope |
| **tenant-deployments/** | Templates deployed at tenant scope |

**Never** place samples in the repository root.

### Naming Rules

- Folder name pattern: `someresource-someconfiguration` or `some-platform-capability-to-demo`
- **All files and folders must be lowercase** except `README.md` (UPPERCASE.lowercase)
- Keep folder names short enough to fit the GitHub column width

### Required Files

| File | Required? | Notes |
|---|---|---|
| **main.bicep** | Yes (preferred) | Primary Bicep template |
| **azuredeploy.json** | Only if no main.bicep | JSON deployment template (auto-built from Bicep on merge) |
| **azuredeploy.parameters.json** | Yes | Parameters file with GEN-* placeholders for CI |
| **metadata.json** | Yes | Index metadata for learn.microsoft.com/samples |
| **README.md** | Yes | Documentation with deploy buttons |

### Optional Files & Subfolders

| Item | Notes |
|---|---|
| **azuredeploy.parameters.us.json** | Separate parameters for Azure US Government Cloud |
| **createUiDefinition.json** | Custom Azure Portal deployment experience |
| **nestedtemplates/** | Subfolder for JSON nested templates |
| **modules/** | Subfolder for Bicep modules |
| **scripts/** | Subfolder for configuration scripts |
| **prereqs/** | Pre-requisite template for CI validation |

---

## 2. Bicep Authoring Rules

### File-Level Element Order

Elements must appear in this order:

1. `targetScope` (if not resourceGroup)
2. `metadata`
3. `param` declarations
4. `var` declarations
5. `resource` / `module` references (existing resources first, then new)
6. `output` declarations

### Parameter Rules

- Every parameter must have a `@description()` decorator
- `@description` must come **first** if other decorators are present
- Place a **blank line** before and after each parameter block
- Use `camelCase` for all symbol names (parameters, variables, resources, outputs)
- Rename decompiled prefixes: remove `_var`, `_param`, `_resource`
- Use short, logical symbolic names for resources (e.g., `storage` not `storageAccountName_resource`)

```bicep
@description('Location for all resources.')
param location string = resourceGroup().location

@description('The name of the storage account.')
param storageAccountName string = 'storage${uniqueString(resourceGroup().id)}'
```

### Resource Property Order

```bicep
@description
@batchSize
resource foo '...' = {
  parent
  scope
  name
  location / extendedLocation
  zones
  sku
  kind
  scale
  plan
  identity
  dependsOn
  tags
  properties
}
```

### Artifact URI Parameters (when needed)

```bicep
@description('The base URI where artifacts required by this template are located including a trailing \'/\'')
param _artifactsLocation string = deployment().properties.templateLink.uri

@secure()
@description('The sasToken required to access _artifactsLocation.')
param _artifactsLocationSasToken string = ''
```

Build URIs with the `uri()` function:

```bicep
var scriptFileUri = uri(_artifactsLocation, 'scripts/configuration.sh${_artifactsLocationSasToken}')
```

---

## 3. JSON Authoring Rules

### Top-Level Property Order

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "apiProfile": "...",
  "parameters": {},
  "functions": {},
  "variables": {},
  "resources": [],
  "outputs": {}
}
```

### Resource Property Order

```json
{
  "comments": "",
  "condition": true,
  "scope": "",
  "type": "Microsoft.Compute/virtualMachines",
  "apiVersion": "2017-12-01",
  "name": "[concat(parameters('virtualMachineName'), copyIndex(1))]",
  "location": "[parameters('location')]",
  "zones": [],
  "sku": {},
  "kind": "",
  "scale": "",
  "plan": {},
  "identity": {},
  "copy": {},
  "dependsOn": [],
  "tags": {},
  "properties": {}
}
```

### Artifact URI Parameters (when needed)

```json
"_artifactsLocation": {
  "type": "string",
  "defaultValue": "[deployment().properties.templateLink.uri]",
  "metadata": {
    "description": "The base URI where artifacts required by this template are located including a trailing '/'"
  }
},
"_artifactsLocationSasToken": {
  "type": "securestring",
  "defaultValue": "",
  "metadata": {
    "description": "The sasToken required to access _artifactsLocation."
  }
}
```

---

## 4. Parameter Best Practices

### Always Parameterize

- Credentials (usernames, passwords, secrets) — **never** use defaultValues for these
- Endpoints or prefixes consumed by humans
- SKUs or sizes that affect cost/performance/availability
- Resource locations

### Location Parameter (Required)

Every template must have a `location` parameter:

```bicep
@description('Location for all resources.')
param location string = resourceGroup().location
```

- Default must be `resourceGroup().location`
- Must **not** contain `allowedValues`
- Use separate location parameters for resources not available in all regions

### Parameter Constraints

- All parameters must have a `description` / `metadata.description`
- Use `@allowed`, `@minValue`, `@maxValue`, `@minLength`, `@maxLength` constraints where appropriate
- Do **not** overuse `allowedValues` for inclusive lists (e.g., all VM SKUs) — only for exclusive choices
- Every `defaultValue` must be valid for all users in the default deployment
- Do not provide defaults for usernames, passwords, or anything that increases attack surface

### Parameters File Placeholders (for CI)

Use these GEN-* placeholders in `azuredeploy.parameters.json`:

| Placeholder | Purpose |
|---|---|
| `GEN-UNIQUE` / `GEN-UNIQUE-[N]` | Globally unique name (alpha-numeric, 3-32 chars) |
| `GEN-SSH-PUB-KEY` | SSH public key |
| `GEN-PASSWORD` | Password |
| `GEN-GUID` | Random GUID |

Additional placeholders exist for VNets, Key Vaults, VHDs, custom domains, App Configuration, etc. Refer to the contribution guide for the full list.

---

## 5. Variables

- Use variables for values referenced multiple times or for complex expressions
- **Never** use variables for `apiVersion` values
- Remove all unused variables
- Avoid concatenating variable names for conditional scenarios — use template expressions and dictionary objects

---

## 6. Resources

### dependsOn

- Only reference resources deployed in the same template
- In Bicep, use symbolic references: `dependsOn: [storageAccount]`
- In JSON, use the resource name: `"dependsOn": ["nicLoop", "[parameters('sqlServerName')]"]`
- Conditional resources are auto-removed from the dependency graph

### resourceId

- In Bicep: use symbolic references (`storageAccount.id`)
- In JSON: use `resourceId()` function

### Reference Properties

- **Never** hard-code resource endpoints or properties — use `reference()` (JSON) or symbolic property access (Bicep)
- Use `environment()` to retrieve cloud-specific endpoints
- **Never** hard-code endpoint suffixes like `.azurewebsites.net`

### Empty / Null Properties

- Exclude all empty or null properties (`{}`, `[]`, `""`, null) from templates
- Exception: top-level JSON properties (parameters, variables, functions, resources, outputs)

### VM Image References

- Must use Azure Marketplace or core platform images — no custom images
- `version` must be `latest` for platform images
- Include `plan` properties for marketplace images
- Use implicit managed disks for OS and data disks

---

## 7. metadata.json

```json
{
  "$schema": "https://aka.ms/azure-quickstart-templates-metadata-schema#",
  "type": "QuickStart",
  "itemDisplayName": "<60 char limit>",
  "description": "<1000 char limit>",
  "summary": "<200 char limit>",
  "githubUsername": "<github-username>",
  "dateUpdated": "<YYYY-MM-DD>"
}
```

- `itemDisplayName`: short description (max 60 chars)
- `summary`: what the sample does (max 200 chars)
- `description`: detailed description (max 1000 chars)
- `type`: one of the values from the schema (typically `QuickStart`)
- `environments`: list of supported clouds; omit to indicate all clouds supported
- `validationType`: set to `Manual` only if required, otherwise omit

---

## 8. README.md

### Required Sections

1. **Badge images** — Public/Gov test dates and results, Best Practice, Cred Scan, Bicep Version
2. **Deploy to Azure** button
3. **Deploy to Azure US Gov** button
4. **Visualize** button
5. **Description** of what the template deploys
6. **Tags** — comma-separated in backticks: `` `Tag1, Tag2, Tag3` ``

### Optional Sections

- Prerequisites
- Deployed resources overview
- Usage / connection instructions
- Notes

### Badge & Button Template

Replace `path-to-sample` with the relative path from the repo root:

```markdown
![Azure Public Test Date](https://azurequickstartsservice.blob.core.windows.net/badges/path-to-sample/PublicLastTestDate.svg)
![Azure Public Test Result](https://azurequickstartsservice.blob.core.windows.net/badges/path-to-sample/PublicDeployment.svg)

![Azure US Gov Last Test Date](https://azurequickstartsservice.blob.core.windows.net/badges/path-to-sample/FairfaxLastTestDate.svg)
![Azure US Gov Last Test Result](https://azurequickstartsservice.blob.core.windows.net/badges/path-to-sample/FairfaxDeployment.svg)

![Best Practice Check](https://azurequickstartsservice.blob.core.windows.net/badges/path-to-sample/BestPracticeResult.svg)
![Cred Scan Check](https://azurequickstartsservice.blob.core.windows.net/badges/path-to-sample/CredScanResult.svg)

![Bicep Version](https://azurequickstartsservice.blob.core.windows.net/badges/path-to-sample/BicepVersion.svg)

[![Deploy To Azure](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazure.svg?sanitize=true)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2FAzure%2Fazure-quickstart-templates%2Fmaster%2Fpath-to-sample%2Fazuredeploy.json)

[![Deploy To Azure US Gov](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/deploytoazuregov.svg?sanitize=true)](https://portal.azure.us/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2FAzure%2Fazure-quickstart-templates%2Fmaster%2Fpath-to-sample%2Fazuredeploy.json)

[![Visualize](https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/1-CONTRIBUTION-GUIDE/images/visualizebutton.svg?sanitize=true)](http://armviz.io/#/?load=https%3A%2F%2Fraw.githubusercontent.com%2FAzure%2Fazure-quickstart-templates%2Fmaster%2Fpath-to-sample%2Fazuredeploy.json)
```

### Images

Store images in an `images/` subfolder. Reference with relative paths:

```markdown
![alt text](images/diagram.png "Description")
```

---

## 9. Target Scope

- Match the deployment scope to the workload scope
- Do **not** require elevated scope (e.g., subscription) when the workload targets a resource group
- Do **not** create the target scope itself unless that is the purpose of the sample (e.g., creating management group hierarchies)

---

## 10. Pre-requisites Template

If your template depends on existing resources (VNet, storage account, etc.):

1. Create a `prereqs/` folder in the template root
2. Add `prereq.azuredeploy.json` or `prereq.main.bicep` and `prereq.azuredeploy.parameters.json`
3. Output values needed by the main template
4. Reference outputs in the main parameters file using `GET-PREREQ-<OutputName>` pattern
5. If prereqs must deploy to the same resource group, add `prereqs/.settings.json`:

```json
{
  "comment": "Prereqs deployed to the same resourceGroup as the sample",
  "PrereqResourceGroupNameSuffix": ""
}
```

---

## 11. CI / PR Validation Rules

- A single PR must reference a **single template** only
- Templates are validated with [arm-ttk](https://github.com/Azure/arm-ttk) and [Template Analyzer](https://github.com/Azure/template-analyzer)
- Deployments are tested in both **Azure Public** and **Azure US Government** clouds (unless metadata.json specifies otherwise)
- When using Bicep, do **not** include `azuredeploy.json` in the PR — it is auto-built on merge
- No absolute URLs in samples — use `_artifactsLocation` / `uri()` pattern for deployment artifacts
- All clouds must be supported unless the platform lacks support

---

## 12. Outputs

- Outputs are recommended for endpoints, IP addresses, and connection info
- **Never** output secrets (passwords, account keys) — outputs may be visible to read-only users

---

## 13. Checklist — Reviewing a Template

Use this checklist when reviewing a quickstart template for compliance:

- [ ] Template is in the correct top-level subfolder
- [ ] All files and folders are lowercase (except README.md)
- [ ] `main.bicep` exists (preferred) or `azuredeploy.json` exists
- [ ] `azuredeploy.parameters.json` exists with GEN-* placeholders
- [ ] `metadata.json` exists with valid schema, display name (≤60 chars), summary (≤200), description (≤1000)
- [ ] `README.md` has deploy buttons, badges, description, and tags
- [ ] Location parameter defaults to `resourceGroup().location` with no `allowedValues`
- [ ] All parameters have descriptions
- [ ] No credentials use defaultValues
- [ ] No hard-coded endpoints or cloud-specific URIs
- [ ] No empty/null properties in resources
- [ ] Variables are not used for apiVersions
- [ ] All unused variables are removed
- [ ] VM images use `version: latest` for platform images
- [ ] OS/data disks use implicit managed disks
- [ ] Outputs do not contain secrets
- [ ] Nested templates are in `nestedtemplates/` (JSON) or `modules/` (Bicep)
- [ ] Scripts are in `scripts/`
- [ ] Bicep element order is correct (targetScope → params → vars → resources → outputs)
- [ ] JSON property order follows best practices
- [ ] Resource properties are in recommended sort order
- [ ] No absolute URLs for deployment artifacts
- [ ] Target scope matches the workload scope

## 14. Checklist — Creating a New Template

1. Choose the correct top-level directory based on the sample type
2. Create a lowercase folder with a descriptive, short name
3. Author `main.bicep` following element and property ordering rules
4. Create `azuredeploy.parameters.json` with GEN-* placeholders
5. Create `metadata.json` with all required fields
6. Create `README.md` from the sample template with correct path substitutions
7. Add `prereqs/` folder if external resources are required
8. Run `arm-ttk` and `Template Analyzer` locally before submitting a PR
9. Ensure the template deploys successfully in both Azure Public and US Government clouds
10. Verify the PR contains changes for a single template only
