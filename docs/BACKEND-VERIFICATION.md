# Backend verification: source and scratch databases only

No deployment was authorized or performed. No live-site workflow, live payment, or live file-persistence verification is claimed. Live acceptance remains outstanding.

## Commands and results

Run from the repository root. Database credentials are loaded from the private local configuration; do not print or commit them.

```bash
set -a
. ~/.config/openfront/scratch-db.env
set +a
export DATABASE_URL="$OPENFRONT_SCRATCH_DB_BASE/scratch_openfront_recycling"

npm run -s test:integration > /tmp/b7-int.log 2>&1
# 27 tests, 27 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo; exit 0.

npm run -s test:unit
# 6 tests, 6 pass, 0 fail.

npx keystone build --no-ui
# Generated GraphQL and Prisma schemas successfully.

npx tsc --noEmit
# Exit 0.

npm run -s test:integration -- tests/storefront-account-team.integration.ts
# After af1f49d's document-download changes: 1 test, 1 pass, 0 fail.

npm run -s test:integration -- tests/storefront-account-team.integration.ts tests/local-storage.integration.ts
# After the bounded access review: 2 tests, 2 pass, 0 fail,
# 0 cancelled, 0 skipped, 0 todo; exit 0 (/tmp/b7-access-review.log).

npx tsc --noEmit
# After the bounded access review: exit 0 (/tmp/b7-access-tsc.log).

npm run -s test:unit
# After the bounded access review: 6 tests, 6 pass, 0 fail.
```

`test:integration` derives `scratch_openfront_recycling_tests`, migrates it, and runs files sequentially. Each integration file imports the database guard. These runs do not execute against the app database. The full 27-test run preceded the cache-control hardening; the two-file focused run verifies that final change. A new full production build was not run for this access-only follow-up; the schema build and TypeScript check are not a substitute for it.

## Agreed starter book

Previously executed twice successfully; **do not rerun merely to inspect data**, since its date-spreading step updates historical timestamps. Historical command:

```bash
export DATABASE_URL="$OPENFRONT_SCRATCH_DB_BASE/scratch_openfront_recycling?connection_limit=3"
node --import tsx scripts/starter-book.ts > /tmp/sb2.log 2>&1
# Exit 0 on the second successful run; record counts unchanged.
```

These are whole-app totals at that verification, including existing records, not solely newly inserted records:

| Record | Count |
|---|---:|
| Sellers | 11 |
| Tickets | 34 |
| Ticket states | 26 settled, 6 completed, 1 open, 1 voided |
| Payout states | 21 paid, 2 held, 2 ready |
| Accounts | 6 |
| Listings | 2 |
| Offers | 2 |
| Invoices | 3 |
| Service requests | 6 |
| Donations | 2 |

Gerald Pruitt remains present. Existing EAST-I-000001 (`cmwrx88ao000ouz8jjtgol3hx`) remains settled at 39624 cents with a paid payout. Tickets span 0–13 days at verification. Kessler's settlement is paid at 261800 cents.

Populated portal accounts, confirmed by a read-only database query:

- Buyer: **Mahoning Valley Steel**, slug `mahoning-valley-steel`, id `cmws4fosd002auzrbwimmxoca`.
- Nonprofit: **Hilltop Youth Robotics**, slug `hilltop-youth-robotics`, id `cmws4fr9x002luzrbl1hgfh1k`.

Contact credentials are outside the repository in `~/.config/openfront/recycling-scratch-logins.txt`. No passwords belong in this report. No further app records, resets, or timestamp/history changes were made for the access review.

## Bounded C12–C14 and private-download access review

Existing policy sources: `requireContact` in `commands/storefront-account.ts`, `requireAccountRole` and invite lifecycle commands in `commands/accounts.ts`, and Account/AccountContact status definitions in `models/parties.ts` (all under `features/keystone`).

- Account statuses are `active` and `suspended`; active contacts can read either. Suspension is **not** a portal-read revocation. No new suspension policy was introduced.
- Contact statuses are `active`, `invited`, and `removed`, not `suspended`. Only active contacts with an admitted role (`admin`, `member`, `billing`, `driver`) can read C12–C14. Invited/removed contacts are refused, even with an existing session or known filename.
- Certificate requests require admin/member membership and an own-account completed/settled ticket. Cross-account ticket ids and foreign account slugs are refused. Duplicate requests do not add another audit event.
- Admins see pending invites and phones; non-admins see active team members without phones. Revoking an actual invitation through `updateAccountContact(remove: true)` invalidates its original acceptance token. That invitee cannot read C12–C14 or download a known filename.
- Hidden documents are absent from the portal and refused by the contact download path, even if the filename was previously learned. Foreign-account users cannot download a shared document by its filename. Missing files, traversal filenames and unauthenticated requests are refused.
- Proven gap fixed: local private downloads previously returned `private, max-age=300`, allowing a compliant browser to serve cached bytes after later revocation without rechecking membership. All successful local private-file/image responses now use **`Cache-Control: private, no-store`**. Tests verify the header and refusal after document hiding or membership revocation. The contact download branch now also matches the portal's account-status and admitted-role policy. Staff access continues through Keystone list/field access; hiding a document from contacts does not revoke authorized staff access.

Tests exercise actual GraphQL operations and the local private-upload response function, not a deployed browser/CDN. The code does not retract files already downloaded. Already cached responses from before this change may remain usable until their old lifetime expires. Direct S3 signed URLs remain valid for up to 300 seconds after issuance even if membership/visibility is revoked; this review did not replace them with an authenticated proxy or verify S3 transport. Treat that bounded revocation delay as an outstanding deployment limitation, not instantaneous revocation.

## Migration requirements

The AccountDocument plural rename (`graphql: { plural: 'AccountDocumentItems' }`) is **GraphQL/Admin metadata only**: it changes generated list queries/types to free `accountDocuments` for the scoped portal query. It does not rename a Prisma model/table/column and requires **no new database migration**. Rebuild the schema and update any generated-list clients to `accountDocumentItems`. C12–C14 and this authorization/cache fix introduce no persistence schema changes.

A deployment still needs the repository's existing migrations applied with `npm run migrate` (`prisma migrate deploy`), including database rules and the weigh-event line-detach migration. Do not use schema reset or destructive push. Migrations were exercised by the isolated integration runner, not applied to a live deployment during this follow-up.

## File persistence requirements and remaining limitations

- Local storage defaults to `.runtime/uploads` under the process working directory; set `UPLOAD_DIR` to a durable mounted volume in deployment. Persist `public`, `private-images`, and `private-files` together with database records. Ephemeral build/container disks do not provide durability across deployments.
- Keep private directories outside any public/static server mapping. Serve private local files only through the authenticated routes. Back up files and database consistently; database backups alone do not preserve documents or seller images.
- Multiple application replicas must share durable file storage, or use S3-compatible storage configured with `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional `S3_ENDPOINT`. Configure bucket policies so private prefixes cannot be fetched publicly. Selecting S3 does not copy existing local files; moving providers needs an explicit object-copy and record-compatibility plan.
- Local file serving and refusal tests passed. Deployment volume mounting, restart/redeploy durability, S3 permissions/signing and CDN behavior remain unverified. Do not infer their readiness from scratch-DB checks.
- Portal reads have bounded limits (documents 200, pending certificate tickets 100); no pagination was added in this review. Certificate requests mark the ticket; issuance remains the staff AccountDocument workflow, not automatic certification.
- Initial focused-test fixture failure was missing staff yard membership; it was corrected and rerun successfully before af1f49d. No unresolved final test failures. Earlier shared-database connection saturation was environmental; successful runs are recorded above.
- No new illustrative records were added to the app for this follow-up. Focused refusal fixtures exist only in the isolated `_tests` database. Shared working-tree changes belonging to other builders were left untouched.
