# ADO work item hierarchy — Azure Networking Q2/Q3 FY26

Use this table to determine the correct parent Epic or Feature when creating work items.

## Workflow → parent mapping

| Workflow Type | Initiative ID | Epic ID | Epic Title | Service Category Mappings |
|---|---|---|---|---|
| content-maintenance | 489791 | 494391 | Meet KPI targets for content quality | none |
| new-feature | 486403 | 498873 | Help customers learn new technology | hybrid-connectivity:498901, load-balancing:498894, foundation:498899, network-security:498896, non-pillar:506322 |
| pm-content | 486403 | 494380 | Engage product PMs on new features | network-security:498902, load-balancing:498904, hybrid-connectivity:498903, foundation:498905, non-pillar:506309 |
| css-support | 486401 | 493879 | Documentation for troubleshooting | hybrid-connectivity:506199, load-balancing:506199, foundation:506199, network-security:506199, non-pillar:506199 |
| partnership | 494424 | 506220 | Partnership collaboration | none |
| content-gap | 489791 | 499268 | Content maintenance - Address content gaps | none |
| mvp-feedback | 494416 | 506328 | Continuously improve and innovate | none |
| architecture-center | 486402 | 494364 | Reliability guidance | none |
| curation | 486402 | 494356 | Coverage for customer decision guidance | bastion-developer:506246, portfolio-consolidation:506242, cost-optimization:506327 |

## How to determine parent ID

1. Find the row matching your `workflow_type`.
2. If **Service Category Mappings = "none"** → the parent ID is the **Epic ID**.
3. If **Service Category Mappings has entries** → Look up the service's category from the [service categories table in service-mappings.md](service-mappings.md), then find the matching Feature ID in the mappings column.
   - Example: ExpressRoute belongs to the "hybrid-connectivity" category → for `new-feature` workflow → parent = **498901**
   - Example: Firewall belongs to the "network-security" category → for `new-feature` workflow → parent = **498896**

## ADO organization details

- **Organization**: msft-skilling
- **Project**: Content
- **Default AreaPath prefix**: `Content\Production\Infrastructure\Azure Networking\`
