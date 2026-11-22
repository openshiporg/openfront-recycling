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
