# Azure Networking services mapping

Use this table to look up the ADO AreaPath, folder, and owner for any Azure Networking service.

## Service table (23 services)

| # | Service Name | Aliases | Owner | Folder | Repository | AreaPath |
|---|---|---|---|---|---|---|
| 1 | Application Gateway | App Gateway, AppGW | Michael Bender | application-gateway/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Application Gateway |
| 2 | Bastion | Azure Bastion | Abdullah Bell | bastion/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Bastion |
| 3 | DDoS Protection | DDoS | Abdullah Bell | ddos-protection/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\DDoS Protection |
| 4 | DNS | Azure DNS | Allen Sudbring | dns/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\DNS |
| 5 | ExpressRoute | Express Route | Duong Au | expressroute/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\ExpressRoute |
| 6 | Extended Zones | - | Hussein Al Kazwini | extended-zones/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Extended Zones |
| 7 | Firewall | Azure Firewall | Duong Au | firewall/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Firewall |
| 8 | Firewall Manager | Azure Firewall Manager | Duong Au | firewall-manager/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Firewall Manager |
| 9 | Front Door | Azure Front Door, AFD | Hussein Al Kazwini | frontdoor/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Front Door |
| 10 | Internet Peering | - | Hussein Al Kazwini | internet-peering/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Internet Peering |
| 11 | Load Balancer | ALB | Michael Bender | load-balancer/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Load Balancer |
| 12 | NAT Gateway | NAT | Allen Sudbring | nat-gateway/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\NAT Gateway |
| 13 | Network Security Perimeter | NSP | Michael Bender | network-security-perimeter/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Network Security Perimeter |
| 14 | Network Watcher | - | Hussein Al Kazwini | network-watcher/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Network Watcher |
| 15 | Peering Service | - | Hussein Al Kazwini | peering-service/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Peering Service |
| 16 | Private Link | PrivateLink | Abdullah Bell | private-link/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Private Link |
| 17 | Route Server | - | Duong Au | route-server/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Route Server |
| 18 | Traffic Manager | - | Allen Sudbring | traffic-manager/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Traffic Manager |
| 19 | Virtual Network | VNet, VNET | Allen Sudbring | virtual-network/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Virtual Network |
| 20 | Virtual Network Manager | VNM, AVNM | Michael Bender | virtual-network-manager/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Virtual Network Manager |
| 21 | Virtual WAN | vWAN | Cheryl McGruire | virtual-wan/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Virtual WAN |
| 22 | VPN Gateway | VPN | Cheryl McGruire | vpn-gateway/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\VPN Gateway |
| 23 | Web Application Firewall | WAF | Hussein Al Kazwini | web-application-firewall/ | azure-docs-pr | Content\Production\Infrastructure\Azure Networking\Web Application Firewall |

## Service categories

Used for determining Feature-level parent work items:

| Category | Services |
|---|---|
| hybrid-connectivity | ExpressRoute, Virtual WAN, VPN Gateway, Route Server |
| load-balancing | Application Gateway, Load Balancer, Front Door, Traffic Manager |
| network-security | Firewall, Firewall Manager, DDoS Protection, Web Application Firewall, Network Security Perimeter |
| foundation | Virtual Network, Virtual Network Manager, DNS, NAT Gateway, Private Link, Bastion |
| non-pillar | Network Watcher, Internet Peering, Peering Service, Extended Zones |

## Team members

| Name | Email | Services Owned |
|---|---|---|
| Duong Au | duau@microsoft.com | ExpressRoute, Firewall, Firewall Manager, Route Server |
| Cheryl McGruire | cherylmc@microsoft.com | Virtual WAN, VPN Gateway |
| Michael Bender | mibender@microsoft.com | Application Gateway, Load Balancer, Network Security Perimeter, Virtual Network Manager |
| Abdullah Bell | abell@microsoft.com | Bastion, DDoS Protection, Private Link |
| Allen Sudbring | allensu@microsoft.com | DNS, NAT Gateway, Traffic Manager, Virtual Network |
| Hussein Al Kazwini | hualkazw@microsoft.com | Extended Zones, Front Door, Internet Peering, Network Watcher, Peering Service, Web Application Firewall |

## Quick lookup by folder

```
articles/application-gateway/     → Application Gateway (Michael Bender)
articles/bastion/                 → Bastion (Abdullah Bell)
articles/ddos-protection/         → DDoS Protection (Abdullah Bell)
articles/dns/                     → DNS (Allen Sudbring)
articles/expressroute/            → ExpressRoute (Duong Au)
articles/extended-zones/          → Extended Zones (Hussein Al Kazwini)
articles/firewall/                → Firewall (Duong Au)
articles/firewall-manager/        → Firewall Manager (Duong Au)
articles/frontdoor/               → Front Door (Hussein Al Kazwini)
articles/internet-peering/        → Internet Peering (Hussein Al Kazwini)
articles/load-balancer/           → Load Balancer (Michael Bender)
articles/nat-gateway/             → NAT Gateway (Allen Sudbring)
articles/network-security-perimeter/ → Network Security Perimeter (Michael Bender)
articles/network-watcher/         → Network Watcher (Hussein Al Kazwini)
articles/peering-service/         → Peering Service (Hussein Al Kazwini)
articles/private-link/            → Private Link (Abdullah Bell)
articles/route-server/            → Route Server (Duong Au)
articles/traffic-manager/         → Traffic Manager (Allen Sudbring)
articles/virtual-network/         → Virtual Network (Allen Sudbring)
articles/virtual-network-manager/ → Virtual Network Manager (Michael Bender)
articles/virtual-wan/             → Virtual WAN (Cheryl McGruire)
articles/vpn-gateway/             → VPN Gateway (Cheryl McGruire)
articles/web-application-firewall/ → Web Application Firewall (Hussein Al Kazwini)
```
