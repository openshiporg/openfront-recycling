# Storefront matrix

Every row of the Storefront Feature Matrix (dissertation §8) and where it lives in the storefront.
Routes are thin wrappers in `app/(storefront)/`; screens are in `features/storefront/screens/`; reads are in
`features/storefront/lib/data/`; writes are server actions in `features/storefront/lib/actions.ts`.
Operation names are the backend's (`docs/STOREFRONT-OPERATIONS.md`).

Status: **built** = page and action wired to the real operation. **built, waits on backend** = page and action are wired, and the
page shows its load error until the backend adds the read named. **not built** = deliberately left out of this storefront
(tier 3, the brief allows this); there is no link to it anywhere in the storefront.

## Public

| Row | Route | Status |
|---|---|---|
| P1 | `/`, `/locations` | built |
| P2 | `/locations/[slug]` | built |
| P3 | `/prices?yard=` | built |
| P4 | `/prices/print?yard=` | built |
| P5 | `/materials` | built |
| P6 | `/materials/[slug]` | built |
| P7 | `/calculator` | built |
| P8 | `/rules?yard=` | built |
| P9 | `/fees?yard=` | built |
| P10 | `/sell` | built |
| P11 | `/containers`, `/containers/[slug]` | built |
| P12 | `/commercial`, `/commercial/apply` | built |
| P13 | `/buyers`, `/buyers/apply` | built |
| P14 | `/market`, `/market/[id]` | built |
| P15 | `/donate`, `/donate/[slug]`, `/donate/apply` (nonprofit application) | built |
| P16 | `/pickup` | built |
| P17 | `/track` | built |
| P18 | `/account/sign-in`, `/account/register`, `/account/reset` | built, `registerCustomer` waits on backend |
| P19 | `/about` | built |

## Seller account (`/account`, signed in)

| Row | Route | Status |
|---|---|---|
| S1 | `/account` | built, waits on backend (`mySellerOverview`) |
| S2 | `/account/profile` | built, waits on backend (`mySeller`, `upsertMySellerProfile`) |
| S3 | `/account/identity` | built, waits on backend (`submitMyIdentity`) |
| S4 | `/account/vehicles` | built, waits on backend (`upsertMyVehicle`, `removeMyVehicle`) |
| S5 | `/sell/check-in` | built, waits on backend (`createMyVisit`) |
| S6 | `/account/visits`, `/account/visits/[id]` | built, waits on backend (`myVisits`, `myVisit`, `cancelMyVisit`) |
| S7 | `/account/tickets` | built, waits on backend (`myTickets`) |
| S8 | `/account/tickets/[id]` | built, waits on backend (`myTicket`) |
| S9 | `/account/tickets/[id]/receipt` | built, waits on backend (`myTicket`) |
| S10 | `/account/payouts` | built, waits on backend (`myPayouts`) |
| S11 | on `/account/tickets/[id]` | built, waits on backend (`myTicket`) |
| S12 | `/account/tickets/[id]/pay` | built (`payInvoiceByCard`, hosted checkout), waits on `myTicket` |
| S13 | Donations list and receipts | not built (tier 3). A donation shows on the ticket and its receipt. |
| S14 | `/account/pickups`, `/account/pickups/[id]` | built (`acceptServiceQuote`, `payServiceRequestByCard`, `cancelServiceRequest`), waits on `myServiceRequests`, `myServiceRequest` |
| S15 | Yearly statement CSV | not built (tier 3) |
| S16 | `/account/applications` | built (`withdrawApplication`), waits on `myApplications` |

## Company portal (`/account/company/[accountSlug]/`)

`/account/company` lists the accounts the person is a contact of (`myAccounts`). Each page checks membership on the server.

| Row | Route | Status |
|---|---|---|
| C1 | `` (home) | built, waits on backend (`accountOverview`) |
| C2 | `prices` | built, waits on backend (`accountPrices`) |
| C3 | `tickets`, `tickets/[id]` | built, waits on backend (`accountTickets`, `accountTicket`) |
| C4 | `sites` | built (`upsertAccountSite`), waits on `accountSites` |
| C5 | `containers` | built, waits on backend (`accountContainers`) |
| C6 | `requests/new` | built (`createServiceRequest`, card fee via `payServiceRequestByCard`) |
| C7 | `requests`, `requests/[id]` | built (`cancelServiceRequest`), waits on `accountServiceRequests`, `accountServiceRequest` |
| C8 | `statements` | built, waits on backend (`accountSettlements`). One page; no per-settlement detail page. |
| C9 | on `statements` | built, waits on backend (`accountCharges`) |
| C10 | `invoices`, `invoices/[id]` | built (`payInvoiceByCard`), waits on `accountInvoices`, `accountInvoice` |
| C11 | `reports`, `reports/csv` | built, waits on backend (`accountDiversionReport`) |
| C12 | Certificates | not built (tier 3) |
| C13 | Team | not built (tier 3). Staff invite contacts from the dashboard (`inviteAccountContact`). |
| C14 | Company vehicles and tares | not built (tier 3) |

## Buyer

| Row | Route | Status |
|---|---|---|
| B1 | `/market`, `/market/[id]` | built |
| B2 | offer form on `/market/[id]` | built (`submitOffer`, with `buyNow`). Shown when `marketListing.canOffer`. |
| B3 to B8 | Offers, orders, shipments, invoices, claims, purchase report | not built (tier 3). The sales team handles these from the dashboard and by email. |

## Nonprofit

| Row | Route | Status |
|---|---|---|
| N1 to N4 | Profile, campaigns, donations credited, disbursements | not built (tier 3). The public side (P15) is built; nonprofits apply at `/donate/apply`. |
