# Storefront operations

Every row of the Storefront Feature Matrix (dissertation §8) mapped to the GraphQL operation(s) that serve it.
All custom operations live in `features/keystone/commands/`. Customer operations prove ownership on the server
before reading through `sudo()`: a seller sees only records whose `seller.user` is the session user; an account
contact sees only accounts where they hold an active `AccountContact`. "Public list read" means the Keystone
list query, filtered by the list's access rules (§7.2).

Money is integer cents. Weights and unit prices are decimal strings. Dates are ISO strings.

Where the operation name differs from the matrix, the reason is in **Notes**.

## 8.1 Public (no sign-in)

| Row | Operation | Input | Returns |
|---|---|---|---|
| P1 | `yards` (public list read, `status = active`), `yardClosures` | Keystone `where`, `orderBy` | Yard fields: `id name slug code addressLine1 addressLine2 city region postalCode country latitude longitude phone email timezone hours acceptsPublic scaleTypes publicNotes payoutMethods closures { date reason isPartial openTime closeTime }` |
| P2 | `yards` + `publicYardRules` | `yardSlug: String` | see P1 and P8 |
| P3, P4, P7, P9 | `publicPriceBoard` | `yardSlug: String` (empty = first public yard) | `PublicPriceBoard { yard { id name slug code timezone addressLine1 city region } publishedAt currencyCode weightUnit entries [PublicPriceItem] items [same] }`. `PublicPriceItem { materialId materialName materialSlug specName categoryName categorySlug categorySortOrder imageUrl direction unit unitPrice unitPriceHigh effectiveFrom minimumWeight }`. Only `isPublic` entries, latest effective per material. `direction = charge_customer` rows are the fee items (P9). |
| P5 | `materials`, `materialCategories` (public list read, `isPublic`) | Keystone `where` | Material and category fields |
| P6 | `publicMaterial`, `publicPriceHistory` | `slug: String!`; `materialSlug: String!, yardSlug: String, days: Int` (7..365, default 90) | `PublicMaterial { id name slug specName description preparationTips categoryName defaultUnit direction minimumWeight imageId prices [{ yardId yardName yardSlug unit unitPrice unitPriceHigh effectiveFrom }] restrictions [{ yardName label kind requiredDocuments forbidCash publicNote }] }`; `[PublicPricePoint { effectiveFrom effectiveTo unit unitPrice unitPriceHigh }]` oldest first |
| P8 | `publicYardRules` | `yardSlug: String` | `PublicYardRules { yardId yardName payoutMethods requireGovernmentId requireIdPhoto requireSellerPhoto requireMaterialPhoto requireVehiclePlate requireSignature requireThumbprint minimumSellerAge cashLimitPerTicketCents cashLimitPerDayCents cashRounding defaultPaymentHoldDays defaultMaterialHoldDays ownershipStatement restrictions [{ label kind materialName materialSlug categoryName allowedMethods requiredDocuments forbidCash paymentHoldDays materialHoldDays mailCheckOnly publicNote }] }`. A yard with no rules profile reports the General template. |
| P10 | static | | |
| P11 | `containerTypes` (public list read, `isPublic`) | Keystone `where` | `id name slug kind capacityLabel dimensions description suitableFor image { url } deliveryFeeCents haulFeeCents rentalFeePerDayCents freeRentalDays dryRunFeeCents` |
| P12, P13 | `submitAccountApplication` (sign-in needed) | `kind: "supplier" \| "buyer" \| "nonprofit"`, `businessName!`, `legalName taxId addressLine1 addressLine2 city region postalCode country phone email materials: JSON monthlyVolume containerNeeds message idempotencyKey` | `AccountApplication { id kind businessName status }` (nonprofit needs `taxId`, the EIN) |
| P14, B1 | `marketListings`, `marketListing` | none; `id: ID!` | `MarketListingsResult { visible canSeePrices listings [MarketListing] }`; `MarketListing { id title description form materialName materialSlug yardName photos availableWeight minimumWeight unit terms closesAt allowOffers buyNow askUnitPrice unitCount units [{ tagNumber form weight }] status canOffer }`. `BusinessSettings.marketVisibility`: `buyers_only` hides the market from non-buyers, `public_without_prices` hides `askUnitPrice` and units, `public` shows all. Active buyer contacts always see prices. |
| P15 | `publicNonprofits`, `publicCampaign` | none; `slug: String!` | `[PublicNonprofit { id name slug legalName ein summary website logoId campaigns [{ id name slug }] }]`; `PublicCampaign { id name slug description imageId status startsOn endsOn goalWeight goalCents raisedCents raisedWeight donorCount nonprofitName nonprofitSlug nonprofitEin }` |
| P16 | `createServiceRequest` (sign-in needed at submit) | see S14 | `ServiceRequest` |
| P17 | `lookupTicketReceipt` | `displayNumber: String, lookupCode: String` (e.g. `MAIN-I-000123`, the code printed on the receipt; case-insensitive) | `TicketReceipt` (below). Wrong pair: `NOT_FOUND`. No ID number or ID image, ever. |
| P18 | `registerCustomer`, `authenticateUserWithPassword`, `endSession`, `sendUserPasswordResetLink`, `redeemUserPasswordResetToken` | see S rows | |
| P19 | `publicBusiness` | none | `PublicBusiness { name legalName logoUrl timezone about supportEmail supportPhone isNonprofit ein weightUnit currencyCode marketVisibility }` (`ein` only when nonprofit) |

### TicketReceipt (P17, S8, S9, C3)

`TicketReceipt { id displayNumber direction status yardName yardAddress sellerName accountName vehiclePlate completedAt createdAt businessName weightUnit paymentMode donatePercent
lines [{ id materialName grossWeight tareWeight netWeight deductionWeight deductionPercent deductionReason payWeight quantity unit unitPrice amountCents direction }]
fees [{ label amountCents }] materialTotalCents feeTotalCents taxCents totalCents
payouts [{ id amountCents status method allowedMethods releaseAt checkNumber paidAt returnReason }]
holds [{ id status releaseAt weight }] adjustments [{ id displayNumber status totalCents }] adjustsDisplayNumber photoIds }`

A held payout past its release time reads `ready`. A police hold reads `held` with no release date.

## §8.2 Seller (signed in) — `features/keystone/commands/storefront-seller.ts`

Every operation finds the Seller whose `user` is the session user; another seller's id answers `NOT_FOUND`. No session answers `UNAUTHENTICATED`.

| Row | Operation | Notes |
|---|---|---|
| P18 | `registerCustomer(name, email, phone?, password)` → `{id name email}` | No staff role. Email is lower-cased; duplicate refuses "An account already uses this email…". Password ≥ 10 chars. Then sign in with `authenticateUserWithPassword`. |
| S1 | `mySellerOverview` | Fields as asked plus `ticketCount`. `seller` is `null` until the first `upsertMySellerProfile`. `pendingCents` = ready + pending payouts; a hold past `releaseAt` counts as ready. |
| S2 | `upsertMySellerProfile(data)` → `MySeller` | First save needs `dateOfBirth` (YYYY-MM-DD). Extra optional `defaultNonprofitId`. Once staff verify the ID, name and date of birth are locked. `dateOfBirth` comes back as `YYYY-MM-DD`. |
| S3 | `submitMyIdentityDocument(data:{kind number issuer expiresOn frontImage backImage})` | **Difference:** `frontImage`/`backImage` are `ImageFieldInput` (`{ upload: Upload! }`), not a bare `Upload`. Stored in `private_images`. Expired IDs refuse. Sends the seller back to `unverified` until staff check the card. |
| S3 | `myIdentityStatus` → `{status documents[...]}` | `status`: `missing` / `on_file` / `verified` / `expired`. Documents add `expired hasFrontImage hasBackImage`. Never returns the full number. |
| S4 | `myVehicles`, `upsertMyVehicle(id?, data)`, `removeMyVehicle(id)` | `kind`: car, pickup, box_truck, trailer, roll_off, semi, other. Plate stored upper-case without spaces. Remove hides it (old tickets keep it). |
| S5 | `createMyVisit(data, idempotencyKey)` → `MyVisit` | Extra optional `donatePercent nonprofitId campaignId`. Refuses: no profile, yard not public, past/over-30-day date, closed day, **no current ID when the yard requires one**, plate required but no vehicle, 5 open visits. |
| S5 | `myVisits`, `myVisit(id)`, `cancelMyVisit(id)` | `plannedDate` is `YYYY-MM-DD`; `expiresAt` ISO. A booked visit past its day reads `expired`. Extra: `donatePercent nonprofitName campaignName ticketId yard{id phone} vehicle{id make model}`. |
| S7 | `myTickets(status, from, to, take, skip)` | `payoutStatus`: `ready held pending paid returned amount_due on_account` or null. Extra `isAdjustment`. `from`/`to` are dates (inclusive). |
| S8 | `myTicket(id)` → `TicketReceipt` | Adds `lookupCode adjustsId invoiceId amountDueCents` (these four are null on the guest lookup). Pay a fee with `payInvoiceByCard(invoiceId)`. |
| S10 | `myPayouts` | Extra `returnReason replacesId createdAt`. |
| S13 | `myDonations(year?)` | `{id receiptNumber status kind amountCents weight nonprofitName campaignName date ticket{id displayNumber}}`; receipt via `myDonationReceipt(donationId)`. |
| S15 | `mySellerYearSummary(year)` | Totals by material and a `csv` string (safe CSV). |
| S16 | `myApplications` | Adds `decidedAt accountSlug` (slug once approved). |
| S14 | `myServiceRequests`, `myServiceRequest(id)` | Requests by this user **not** on a company account. `job` is the DispatchJob. Adds `canPay canAcceptQuote canCancel containerTypeName`. |
| C0 | `myAccounts` | `{id slug name status role isSupplier isBuyer isNonprofit}` |

## §8.3 Company portal (signed-in contact) — `features/keystone/commands/storefront-account.ts`

Every query takes `accountSlug`; the user must hold an **active** AccountContact on it. Wrong or foreign slug/id → `NOT_FOUND` (never reveals the account). No session → `UNAUTHENTICATED`. A `driver` contact gets `FORBIDDEN` on settlements, charges and invoices (money is admin/billing/member).

Shapes match `features/storefront/lib/data/company.ts` exactly; every storefront query was validated against the built schema.

| Row | Operation | Notes |
|---|---|---|
| C1 | `accountOverview` | `monthWeight`/`monthValueCents`: completed tickets this calendar month (UTC). `unsettledCents` = unsettled on-account tickets minus open charges. `openInvoiceCents` = open + partially paid balances. |
| C2 | `accountPrices` | Latest current entry per material on the account's own price list; empty when none (the board is on `publicPriceBoard`). |
| C3 | `accountTickets(siteId materialId from to take skip)`, `accountTicket(id)` | Excludes open tickets. `netWeight` sums non-`each` lines. `accountTicket` is `TicketReceipt` (+`lookupCode`). |
| C4 | `accountSites` | All sites, active first. |
| C5 | `accountContainers` | Containers `at_customer`, `assigned`, `in_transit`. `rentalAccruingCents` = days past free days (or past `rentalChargedThrough`) × type daily rate. |
| C7 | `accountServiceRequests`, `accountServiceRequest(id)` | Same `MyServiceRequest` shape; `yard` also has `timezone` (added for `requests.ts`). |
| C8 | `accountSettlements` | Excludes drafts. |
| C9 | `accountCharges(unsettledOnly)` | **Schema change:** the generated AccountCharge list is renamed (`accountChargeItems`, `AccountChargeItems*`) so this name is the portal's. Dashboard uses list metadata, so nothing else changes. |
| C10 | `accountInvoices`, `accountInvoice(id)` | Excludes void. Payments list succeeded/reversed only. Pay with `payInvoiceByCard`. |
| C11 | `accountDiversionReport(year)` | Rows by `YYYY-MM` × material; CSV is built in the storefront. |

## §11 Onboarding — `features/keystone/commands/onboarding.ts`, `features/recycling/templates.ts`

- `runOnboarding(data: RunOnboardingInput!, idempotencyKey)` (needs `canManageOnboarding`). Steps: business → roles (10) → rules template (general / ohio / florida / custom) → first yard (hours, payout methods, `acceptsPublic`) → 44 scrap materials (or 51 for `community_centre`, which also makes the business a nonprofit) → board prices published today via `publishPrices` → tier lists "Standard Commercial" and "Wholesale Tier A" → 5 container types and 12 containers → 2 trucks, truck and floor scale, cash drawer → Stripe provider row. Running again adds nothing.
- `publishPrices(priceListId, entries, effectiveFrom, idempotencyKey)` (needs `canManagePricing`): append-only; closes the open entry per material.
- CLI for a fresh database: `node --import tsx scripts/onboard.ts onboarding.json`.
- Several yards in one run: `additionalYards` (each gets the same rules, its own board with the same starting prices, its scales and a cash drawer; `acceptsPublic: false` hides a commercial-only yard from walk-in pages).
- **App database `scratch_openfront_recycling` (reset 2026-11-22, then onboarded from `onboarding/riverside-metals.json`):** Riverside Metals, (614) 555-0142, Ohio rules. Yards: `riverside-metals-east` (1840 Joyce Ave, Columbus; truck and floor scale), `riverside-metals-west` (3400 Valleyview Dr, Columbus; floor scale), `riverside-metals-groveport` (5225 Rohr Rd, Groveport; commercial only). 44 materials; each board shows 43 public prices (converters are priced at the counter). One staff owner and one customer; their passwords are kept outside the repo.
- **Integration tests never touch the app database.** `npm run test:integration` creates and migrates `<app db>_tests` (or `TEST_DATABASE_URL`) and runs the files one at a time there. `tests/db-guard.ts` makes every integration file refuse a database whose name does not end in `_tests`.
- Not yet: the "starter book" (sellers, accounts, tickets) from §11.

## §9 Staff reads for the dashboard — `features/keystone/commands/staff-boards.ts`

Reads only; every change goes through the existing commands. Each checks a role flag and the yard (§7.2).

| Screen | Query | Flags (any) | Notes |
|---|---|---|---|
| Scale-house board | `scaleHouseBoard(yardId)` → `checkedIn` (today's booked/arrived visits without a ticket), `weighing` (open, no lines), `readyToComplete` (open with lines, plus `missing: [ComplianceItem]` from the real checklist), `readyToPay` (ready/held payouts) | canManageTickets, canGradeTickets, canPaySellers | "Today" is the yard's time zone |
| Payout queue | `payoutQueue(yardId, includeReturned)` (existing; `includeReturned` is new) | canPaySellers, canManageFinance | Held payouts whose time is up become ready on read |
| Drawer | `drawerState(yardId)` → per drawer: open/counting session (expected, totals by kind, last 25 events, `isMine`) or the last close; `pendingApproval` | canPaySellers, canManageCashDrawers, canManageFinance | Actions: openDrawerSession, moveDrawerCash, countDrawer, recountDrawer, approveDrawerClose |
| Price board grid | `priceBoardGrid(priceListId)` → every active material with current price, high, unit, public flag, previous price, change, scheduled price | canManagePricing, canManageTickets, canManageMaterials | Publish with `publishPrices(priceListId, entries, effectiveFrom)` |
| Seller search | `searchSellers(q, limit)` matches name tokens, ID number (normalised), phone digits (4+), plate (on vehicles and past tickets); `matchedOn` says why | canManageTickets, canManageSellers, canManageCompliance, canPaySellers | Returns only the last 4 of the ID number |

## §8.4 Buyer and §8.5 Nonprofit — `features/keystone/commands/storefront-buyer.ts`

Every read takes `accountSlug` and proves an active contact (`requireContact`); another company's slug answers NOT_FOUND. A non-buyer account gets FORBIDDEN on buyer reads, and a non-nonprofit account gets FORBIDDEN on nonprofit reads.

| # | Operation | Notes |
|---|---|---|
| B1 | `marketListings`, `marketListing` | existing (§8.1) |
| B2 | `submitOffer(listingId, accountId, weight, unitPrice, pickupFrom, pickupTo, message, buyNow, idempotencyKey)` | existing. **Difference:** there is no separate `buyNow` mutation. Pass `buyNow: true`, which accepts at the asking price and creates the confirmed order |
| B3 | `accountOffers(accountSlug)`; `respondToOffer(offerId, response: accept\|decline\|withdraw)` | **Difference:** one `respondToOffer` instead of `respondToCounter` and `withdrawOffer`. `canAcceptCounter` and `canWithdraw` say which buttons to show. Drivers are refused |
| B4, B5 | `accountSalesOrders(accountSlug)`, `accountSalesOrder(accountSlug, id)` | Lines show ordered against shipped weight. Shipments show carrier, BOL, seal, weights, units/tags and invoice. `gatePass` is null until the yard releases the load. `canClaim` is true once delivered |
| B6 | `accountInvoices`, `accountInvoice`, `payInvoiceByCard` | existing (§8.3) |
| B7 | `fileClaim(shipmentId, kind, description, claimedCents, photos)`, `accountClaims(accountSlug)`, `withdrawClaim(claimId)` | **Difference:** named `fileClaim` rather than `openClaim`. `kind` is one of short_weight, contamination, wrong_grade, damage, other |
| B8 | `accountPurchaseReport(accountSlug, year)` | Material lines of sale invoices for released loads, by month (from `releasedAt`) and material. Admin and billing roles only |
| N1 | `accountNonprofit(accountSlug)` (read), `updateNonprofitProfile(accountId, nonprofitSummary, nonprofitWebsite, isPublicNonprofit)` | The website must start with https://. Only an admin may edit (`canEdit`). The read also returns the campaigns with progress |
| N2 | `upsertCampaign(accountId, campaignId, name, description, goalWeight, goalCents, startsOn, endsOn, isPublic, status)`, `endCampaign(campaignId)` | existing. Admin or member |
| N3 | `accountDonations(accountSlug, campaignId, take, skip)` | Credited and disbursed donations only. `donorName` ("Ruth A.") appears only when the donor agreed (`showDonorName`) |
| N4 | `accountSettlements(accountSlug)` | existing (§8.3) |
