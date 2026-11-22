# Openfront Recycling

Software for scrap metal yards and recycling centres. At the scale house it weighs loads, grades material and completes tickets under the local scrap-metal rules. At the counter it pays sellers. Behind the counter it runs commercial accounts with roll-off containers and dispatch, and it sells graded material to mills and brokers. Nonprofits can take donations from sellers.

Built on Next.js and Keystone 6 with PostgreSQL. The customer storefront, the staff dashboard and the GraphQL API all run in one Next.js app.

## What it does

- **Scale house.** A seller is found or created, then their vehicle. The load is weighed (a truck scale reading in sequence, or a floor scale), graded, priced from the yard's board and photographed. The checklist shows exactly what is missing before the ticket can be completed: ID, photos, signature, thumbprint, proof of ownership, do-not-buy matches. Ohio and Florida rule templates set holds, no-cash rules and nickel rounding.
- **Cashier.** A payout queue (ready, held with a release time, returned), with payment by cash from a counted drawer, by check or by transfer. Drawer open, add, drop, count and close, with variance approval.
- **Prices.** A board per yard, plus tier and contract lists. Prices are append-only and published with an effective time. Public prices appear on the storefront.
- **Accounts.** Applications, contacts with roles, sites, containers with rental after the free days, service requests and dispatch jobs, settlements and invoices.
- **Sales.** Listings, offers and counter-offers, sales orders, outbound shipments with BOL, seal and gate pass, buyer invoices paid by card or wire, and claims.
- **Inventory.** Balances by yard and material at average cost, tagged units, processing runs, transfers and adjustments.
- **Compliance.** Material and police holds, a do-not-buy list with CSV import, theft alerts, daily police reports as CSV, and an audit log of every command.
- **Nonprofits.** Campaigns, donations from a ticket's payout, receipts and disbursement.

The full specification lives in the dissertation for this vertical. `docs/STOREFRONT-OPERATIONS.md` lists every customer-facing and staff-board operation, with the access rules for each.

## Getting started

Requires Node.js 20+ and PostgreSQL 14+.

```bash
npm install
cp env.example .env   # set DATABASE_URL and SESSION_SECRET
npm run dev           # keystone build, prisma migrate deploy, next dev
```

Then set up the business. Either sign in as the first user, who becomes the Owner with every permission, and follow onboarding in the dashboard, or run it from the command line on a fresh database:

```bash
node --import tsx scripts/onboard.ts onboarding/riverside-metals.json
```

Onboarding sets up:
- **Business and yards:** the business, its yards with hours and payout methods, and a cash drawer at each yard.
- **Rules:** a rules template (general, Ohio, Florida or custom).
- **Materials and prices:** the scrap-yard material list (44 grades), or the community-centre list. Each yard's board is published at today's prices, and two tier lists are created.
- **Equipment:** container types and a fleet, trucks and scales.
- **Staff roles:** 10 of them.
- **Payments:** the Stripe provider entry.

Running it again adds nothing. `onboarding/riverside-metals.json` is a complete example with three yards.

### Settings

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Always |
| `SESSION_SECRET` | Always (32+ characters) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments (service fees, fee tickets, invoices). Cash, check, transfer and recorded wire payments work without them |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Password-reset and notification email |
| `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` | Optional S3-compatible storage for photos and ID images. Files are stored locally (`UPLOAD_DIR`) without it |
| `PUBLIC_BASE_URL` / `NEXT_PUBLIC_SITE_URL` | Links in email and payment returns |
| `DATABASE_CONNECTION_LIMIT` | Prisma pool size for the web process (default 15) |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Build Keystone, apply migrations, start Next.js |
| `npm run build` / `npm start` | Production build and server |
| `npm run migrate:gen` | Generate a migration after a schema change |
| `npm run migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run test:unit` | Ticket math and pure rules |
| `npm run test:integration` | Command flows against a real PostgreSQL database (see below) |

### Integration tests

The integration tests never run against the app's database. `npm run test:integration` derives a test database from `DATABASE_URL` by adding `_tests` to the name (or uses `TEST_DATABASE_URL`). It creates that database if needed, applies the migrations, and runs the files one at a time. Every test file imports `tests/db-guard.ts`, which refuses any database whose name does not end in `_tests`.

```bash
npm run test:integration                                       # all files
npm run test:integration -- tests/ticket-flow.integration.ts   # one file
```

## How the code is organised

| Path | What is there |
|---|---|
| `features/keystone/models/` | Keystone lists: parties, tickets, money, inventory, dispatch, compliance, business |
| `features/keystone/commands/` | Every state change as a command (`runCommand`: permission, yard check, idempotency key, serialisable transaction, audit event), plus the storefront and staff read operations |
| `features/keystone/lib/` | Command runner, domain helpers, sales and inventory posting |
| `features/recycling/` | Pure rules: ticket math, compliance checklist, onboarding templates |
| `features/integrations/payment/` | Payment adapters (Stripe, manual) |
| `features/storefront/`, `app/(storefront)/` | Customer site: prices, rules, booking a visit, seller account, company portal, market |
| `features/platform/`, `app/dashboard/` | Staff dashboard |
| `app/api/` | GraphQL, payment webhooks, scale readings (`POST /api/scale-readings` with a per-scale key), MCP |
| `migrations/` | Prisma migrations |

**Access, in short.** Staff hold a role with flags such as `canManageTickets`, `canPaySellers` and `canManagePricing`, and they act only at their assigned yards. Owners act at every yard. Customers see only their own seller records, and only the accounts where they are an active contact. Every customer read proves that ownership first, and a record owned by someone else answers "not found".
