# Storefront matrix

Every row of the Storefront Feature Matrix (dissertation §8) and where it lives in the storefront.
Routes are thin wrappers in `app/(storefront)/`; screens are in `features/storefront/screens/`; reads are in
`features/storefront/lib/data/`; writes are server actions in `features/storefront/lib/actions.ts`.
Operation names are the backend's (`docs/STOREFRONT-OPERATIONS.md`).

Status: **built** = page and action wired to the real operation. Every operation named below exists in the
schema (checked 2026-11-22). **not built** = deliberately left out of this storefront
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
| P18 | `/account/sign-in`, `/account/register`, `/account/reset` | built |
| P19 | `/about` | built |

## Seller account (`/account`, signed in)

| Row | Route | Status |
|---|---|---|
| S1 | `/account` | built (`mySellerOverview`) |
| S2 | `/account/profile` | built (`mySellerOverview`, `upsertMySellerProfile`) |
| S3 | `/account/identity` | built (`submitMyIdentityDocument`, `myIdentityStatus`) |
| S4 | `/account/vehicles` | built (`upsertMyVehicle`, `removeMyVehicle`) |
| S5 | `/sell/check-in` | built (`createMyVisit`) |
| S6 | `/account/visits`, `/account/visits/[id]` | built (`myVisits`, `myVisit`, `cancelMyVisit`) |
| S7 | `/account/tickets` | built (`myTickets`) |
| S8 | `/account/tickets/[id]` | built (`myTicket`) |
| S9 | `/account/tickets/[id]/receipt` | built (`myTicket`) |
| S10 | `/account/payouts` | built (`myPayouts`) |
| S11 | on `/account/tickets/[id]` | built (`myTicket`) |
| S12 | `/account/tickets/[id]/pay` | built (`payInvoiceByCard`, hosted checkout), waits on `myTicket` |
| S13 | `/account/statements` (donations), `/account/donations/[id]/receipt` | built (`myDonations`, `myDonationReceipt`) |
| S14 | `/account/pickups`, `/account/pickups/[id]` | built (`acceptServiceQuote`, `payServiceRequestByCard`, `cancelServiceRequest`), waits on `myServiceRequests`, `myServiceRequest` |
| S15 | `/account/statements`, `/account/statements/csv` | built (`mySellerYearSummary`; the CSV is built in the storefront with the formula guard) |
| S16 | `/account/applications` | built (`withdrawApplication`), waits on `myApplications` |

## Company portal (`/account/company/[accountSlug]/`)

`/account/company` lists the accounts the person is a contact of (`myAccounts`). Each page checks membership on the server.

| Row | Route | Status |
|---|---|---|
| C1 | `` (home) | built (`accountOverview`) |
| C2 | `prices` | built (`accountPrices`) |
| C3 | `tickets`, `tickets/[id]` | built (`accountTickets`, `accountTicket`) |
| C4 | `sites` | built (`upsertAccountSite`), waits on `accountSites` |
| C5 | `containers` | built (`accountContainers`) |
| C6 | `requests/new` | built (`createServiceRequest`, card fee via `payServiceRequestByCard`) |
| C7 | `requests`, `requests/[id]` | built (`cancelServiceRequest`), waits on `accountServiceRequests`, `accountServiceRequest` |
| C8 | `statements` | built (`accountSettlements`). One page; no per-settlement detail page. |
| C9 | on `statements` | built (`accountCharges`) |
| C10 | `invoices`, `invoices/[id]` | built (`accountInvoices`, `accountInvoice`, `payInvoiceByCard`) |
| C11 | `reports`, `reports/csv` | built (`accountDiversionReport`) |
| C12 | Certificates | not built: no portal read yet (`accountDocuments` per account, `requestTicketCertificate`); asked of the backend 2026-11-22 |
| C13 | Team | not built: `inviteAccountContact` and `updateAccountContact` exist, but there is no team read for the portal; asked of the backend 2026-11-22. Staff invite contacts from the dashboard meanwhile. |
| C14 | Company vehicles and tares | not built: no `accountVehicles` read yet; asked of the backend 2026-11-22 |

## Buyer

| Row | Route | Status |
|---|---|---|
| B1 | `/market`, `/market/[id]` | built |
| B2 | offer form on `/market/[id]` | built (`submitOffer`, with `buyNow`). Shown when `marketListing.canOffer`. |
| B3 | `offers` | built (`accountOffers`, `respondToOffer` accept, decline, withdraw from `canAcceptCounter`, `canWithdraw`) |
| B4 | `orders` | built (`accountSalesOrders`) |
| B5 | `orders/[id]` | built (`accountSalesOrder`: lines, loads, BOL, seal, tags, gate pass) |
| B6 | `invoices`, `invoices/[id]` | built (shared with C10; shipment invoices link from each load) |
| B7 | claim form per delivered load on `orders/[id]`; `claims` | built (`fileClaim`, `accountClaims`, `withdrawClaim`) |
| B8 | `purchases` | built (`accountPurchaseReport`) |

## Nonprofit

| Row | Route | Status |
|---|---|---|
| N1 | `cause` | built (`accountNonprofit`, `updateNonprofitProfile`, admin only via `canEdit`) |
| N2 | `cause` | built (`upsertCampaign`, `endCampaign`) |
| N3 | `donations` | built (`accountDonations`, by campaign, paged) |
| N4 | `statements` | built (shared with C8, `accountSettlements`) |
