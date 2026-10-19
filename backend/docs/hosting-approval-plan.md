# Private hosting preparation and public launch path

Prepared 13 October 2026. On 17 October 2026, Mike approved the $45.15/month DigitalOcean baseline for private owner/staff testing, keeping the frontend on Vercel and public access/live payments disabled. Additional costs require approval. A separate restore-test cluster was subsequently approved up to $1, with removal after verification. Business-policy publication and public launch remain unapproved.

The release input accepts `paystackMode: "disabled"` with an empty `PAYSTACK_SECRET_KEY` when a test key is unavailable. This disables payment reconciliation and never enables live payments. The default remains `test`, which requires a real test key. Do not invent placeholder provider credentials to satisfy startup checks.

Read [the owner meeting brief](../../OWNER_MEETING_BRIEF.md) for prices, plain-language policy questions and the purchase worksheet. This file is the operator handoff.

## Starting configuration

| Component        | Reviewed starting setting                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| API              | One `apps-s-1vcpu-1gb-fixed`, $10/month; pool maximum 4                                                                                   |
| Identity worker  | One `apps-s-1vcpu-0.5gb`, $5/month; pool maximum 1                                                                                        |
| General worker   | One `apps-s-1vcpu-0.5gb`, $5/month; pool maximum 2                                                                                        |
| Deployment check | Existing `migrate` image/job name, 1 GiB, `PRE_DEPLOY`; **command is read-only `scripts/check-database-safety.ts`**, billed while running |
| Database         | Managed PostgreSQL Standard Basic Regular, one 1 GiB node, minimum 10 GiB disk, quoted $15.15/month                                       |
| Registry         | Basic, $5/month; four repositories, immutable image digests                                                                               |
| Object storage   | Spaces Standard, $5/month, private bucket; CDN/public listing disabled for private assets                                                 |
| Frontend         | Existing Vercel project; verify commercial plan. Pro baseline $20/month if not already subscribed                                         |

DigitalOcean baseline: **$45.15/month**. With a new one-seat Vercel Pro subscription: **$65.15/month**. Prices, exclusions and official source links are in the meeting brief. Do not use this estimate as a binding quotation or a hard spending cap.

London is the proposed application/database/Spaces location, subject to actual availability, capacity and approved data location. App Platform and resource slugs differ; retrieve the actual slugs before filling inputs. Choose the nearest available Registry region from `doctl registry options available-regions`; do not assume Registry offers every application region. This is a geographic starting choice, not a measured latency claim. [Registry availability](https://docs.digitalocean.com/products/container-registry/details/availability/)

No autoscaling, standby node, dedicated egress IP, Kubernetes, Redis or paid observability add-on is included. This single-instance, single-database-node setup has downtime risk. Before public use, measure peak traffic and decide whether the recovery/downtime requirements justify additional capacity or redundancy.

The 1 GiB database currently has **22 available backend connections**. The application pools total 7, or 14 with one overlapping deployment, leaving 8 for deployment checks and operational work. The Prisma CLI does not use the runtime `DB_POOL_MAX` limit: run checks/migrations serially and observe real usage. Do not run multiple rollouts, backups and operator sessions concurrently against the small plan. Upgrade only after approval if measurements show this budget is insufficient. [PostgreSQL limits](https://docs.digitalocean.com/products/databases/postgresql/details/limits/)

## Private access is an application gate

Backend and frontend support `PRIVATE_TESTING_ENABLED=true` with the **same** `PRIVATE_TESTING_PASSWORD`, generated as 32 random bytes encoded in 64 lowercase hexadecimal characters. The browser's username is `allied-test`. This uses HTTP Basic authentication over HTTPS before the normal application account/session/MFA/CSRF checks. It is appropriate for a small controlled test group; individual app accounts still identify actions.

The App template enables the backend gate. On Vercel configure these variables on the exact staging deployment environment, alongside `BACKEND_ORIGIN`, `SITE_ORIGIN`, `SITE_INDEXING=disabled`, and the required media/storage host allowlists. Never use a `NEXT_PUBLIC_` prefix for the password. Check custom, default and preview hostnames; remove stale unprotected deployments from the test audience through a separately reviewed deployment action. Do not alter an existing public frontend deployment merely to create staging.

Generate credentials locally without printing them:

```powershell
# From backend; exclusive creation, ignored directory and restricted permissions.
node scripts/deployment/release.mjs private-access
```

This writes `ops/digitalocean/.private/private-access.json`; it refuses to overwrite an existing file. Transfer the password privately into `inputs.json`'s `values.PRIVATE_TESTING_PASSWORD` and the Vercel staging secret. Share it only with the named testers through a secure channel. Do not rotate the four application encryption/signing keys when rotating the perimeter password. Browser Basic-auth state can outlive application sign-out; close the private browser session on a shared device, and rotate the perimeter secret when a tester leaves.

The frontend gate covers API rewrites, page requests, optimized-image requests and prefetch requests. Checked-in brand artwork under the narrowly matched `/images/allied-autotech/<filename>` path remains readable because Next's internal optimizer omits credentials; customer/business uploads never live there and remain protected behind the API. All other assets remain gated. The server-only public-data client supplies the same credential to the backend and refuses redirects. The backend gate applies equally to its default and custom hostnames. Only exact GET/HEAD health paths and POST provider-webhook paths bypass it; existing webhook signature verification still applies. No registration, catalogue or administration bypass is added. Invalid enabled configuration fails closed.

## Database releases preserve the backup safeguards

App Platform has ephemeral storage and cannot supply a durable backup filesystem. Therefore its `PRE_DEPLOY` job **checks** an already migrated database; it does not perform migrations. The `migrate` image's default Docker command remains the guarded migration runner, so the image can also be used with a properly mounted, verified backup receipt by a release operator. The App Spec explicitly overrides that command to the read-only checker. [App Platform storage limits](https://docs.digitalocean.com/products/app-platform/details/limits/)

Use this order for every release:

1. Review/commit the exact backend source and migration files. Replay all migrations on a **new empty isolated `_test`/`_ci` database**, regenerate the client and run relevant business tests. Never reuse the application database for tests.
2. Confirm the actual remote hostname, port, database and deployment environment. Record the target without credentials. Review role ownership and grants. Application/worker, migration and backup credentials remain separate. No grant changes were applied by this preparation.
3. Verify automated encrypted off-device backups and their retention on the actual managed cluster. DigitalOcean documents daily backups and seven-day PITR; capture actual evidence and test restoration to a separate approved resource. Managed backup retention is not the customer-record deletion policy. Deleting a cluster can remove its managed backups, so keep independently protected recovery evidence/copies for changes. [PostgreSQL backup features](https://docs.digitalocean.com/products/databases/postgresql/details/features/), [restore behavior](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/)
4. On a trusted release computer/runner with durable protected storage, use the separate backup role and the reviewed release checkout to run `npm run db:backup`. Use compatible `pg_dump`/`pg_restore`, strict TLS and the actual CA. Preserve the archive/receipt outside the repository and image layers. Protect a recovery copy off-device using an approved encrypted location; do not leave the only copy on an ephemeral runner. This step does not replace scheduled provider backups.
5. Switch the runner's process environment to the migration role, keeping the same exact target. Set `DB_MIGRATION_TARGET=actual-host:port/database` and `DB_SAFE_MIGRATION_BACKUP` to the verified receipt. The archive must accompany it and be less than one hour old. Run **`npm run db:migrate`**. Do not invoke bare deploy/reset/push/resolve commands or set internal handoff flags. Follow [database-safety.md](database-safety.md).
6. Require `npm run db:check` to pass. Drift, checksum/history failures, backup failures or destructive pending SQL stop the release. The new reservation-acceptance migration requires draining older reservation writers during transition; follow that feature's rollout note rather than assuming every pending migration is rolling-compatible.
7. Build/push the approved immutable images, render/validate the private App Spec, and submit the exact app update only within the approved rollout. The read-only `PRE_DEPLOY` job uses the existing separate migration credentials, confined to the one-shot job; runtime containers never receive them. A failed check prevents new images from promotion. A future dedicated read-only check role is possible after grant-impact review; do not substitute the runtime role, which intentionally cannot read the migration ledger.
8. Verify health, worker heartbeats, cloud TLS/permissions and acceptance flows before inviting testers. Record outcomes in the release record. Roll back application images only when schema compatibility permits; do not roll the database back by deleting migrations or restoring over it.

The Docker migration image does not include PostgreSQL dump executables. Its guarded default needs a verified receipt/archive mounted from the trusted backup runner; otherwise use the documented host `npm run db:migrate` workflow. Do not weaken backup requirements to make a job pass.

## Concrete execution order after purchase approval

1. Recheck the provider's current quote, subscription inventory and region availability. Reuse already paid resources only after confirming ownership/isolation; never buy a duplicate silently. Obtain Mike's explicit approval for each new subscription/resource and any temporary restore resource.
2. Create only the approved Registry, managed database, private Spaces subscription/bucket and App resources. Keep the database target dedicated to staging; enforce trusted sources, certificate/hostname verification and reviewed roles. Configure backup/PITR evidence and spending alerts immediately. Alerts do not prevent overage charges.
3. Complete the protected [inputs](../ops/digitalocean/inputs.example.json). Preserve stable application keys. Supply Paystack **test** credentials and bucket-scoped Spaces credentials securely. Configure bucket CORS from the checked-in allowlist, adjusting only to the actual staging frontend origin. Validate checksum, image verification, signed URL expiry and unauthorized access on the actual bucket.
4. Complete the database release workflow above. The release helper refuses to push a dirty source tree. No commit or registry push was performed during preparation.
5. Follow [digitalocean-staging-release.md](digitalocean-staging-release.md) for image provenance, spec generation/validation and exact-target create/update. Obtain the actual ingress from DigitalOcean, then configure `api-staging.alliedautotech.com` with valid TLS. Keep Cloudflare DNS-only initially; do not invent an IP or blindly trust forwarding headers.
6. Configure the private Vercel staging deployment at `staging.alliedautotech.com`. Point its server-side `BACKEND_ORIGIN` at the actual HTTPS backend; redeploy to rebuild rewrites. Browser API calls remain same-origin `/api/v1/...`.
7. Use verified owner/staff accounts and synthetic test customers. Confirm the super-admin bootstrap/invitation process instead of seeding a default administrator password. Set up Resend's verified sender and allowlisted tester delivery only after rotating the previously documented exposed provider key. Keep SMS/Monnify/live Paystack disabled.
8. Complete the acceptance checklist below, report the observed result and obtain owner/staff acceptance. Do not describe a successful deployment health check as completion of all business workflows.

## Required hosted acceptance

- Unauthenticated default/custom/preview frontend and direct API requests are denied. Valid private credentials still require app login and correct role/MFA/CSRF. Browser credentials work through the Vercel API rewrite, and server-rendered catalogue requests work. No secret appears in rendered HTML, response headers or logs.
- HTTPS, wrong-host/wrong-CA rejection, trusted-source firewall, rate-limit client-IP behavior and runtime-role DML/DDL boundaries are verified. Use isolated synthetic records for write tests.
- All migrations/history/schema pass; the guarded migration rejects a missing/wrong/stale backup; a pending migration or drift causes deployment-check failure. No runtime auto-migration occurs.
- Restore **actually completes** in a separate target. Verify record counts/relationships, financial/audit history, constraints, permissions and critical read flows without exposing records in logs. Record recovery point/time. Do not count `pg_restore --list` or a hash check as restoration.
- API and both workers remain healthy under a representative owner/staff session, upload and background-task load. Measure memory, query/pool wait, latency and job delays on the proposed sizes. Upgrade only after approval if needed.
- Super Admin service/vehicle images, customer profile/garage images, private-media denial, replacement/deletion and orphan cleanup pass against Spaces. Uploaded files do not become public just because they exist in storage.
- Form drafts survive navigation/reload as designed; account isolation, successful-submission clearing and sensitive consent exclusions remain correct.
- Listings appear only under the existing publication/availability rules. Unapproved agreement/deposit/accounting flows fail closed. Test-mode webhook replay, amount/reference mismatch and delayed provider confirmation are handled without real money.
- Verified/allowlisted essential emails arrive, password reset and privileged invitations work, and operations/refund/dispute alerts have named responders. Marketing and automated privacy deletion remain disabled.

## Transition to public customers

Keep staging and production as separate environments; use the same reviewed release mechanism and configuration structure. Do not copy test customers, synthetic approvals, encryption keys or provider credentials into production. Approve the production cost separately, including whether to retain staging. A second equivalent backend adds approximately $35.15/month while shared Registry/Spaces allowances remain sufficient; a larger or redundant production configuration costs more.

Supply the approved policies listed in the meeting brief, publish through the proper owner workflows, and finish/test any policy-driven changes. Configure production origins, new app keys, private bucket/credentials, real provider contracts and separately approved live-payment activation. Re-run restore, permissions, media, payment and load acceptance in that environment. Keep a compatible prior application release and a forward recovery plan.

Only after public-release approval set `PRIVATE_TESTING_ENABLED=false` on production frontend/API, remove its perimeter password, enable indexing for the correct public origin and cut over DNS. Do not disable the staging gate. Live payments, marketing and destructive data operations each retain their own authorization gates.

## Preparation evidence and remaining inputs

Prepared: lean App template, bounded connection pools, private-test perimeter on both runtimes, secure local credential generator, read-only deployment command, guarded migration image retained, meeting worksheet and release checklist. A private access credential was generated in the ignored protected directory and added to the existing private inputs without changing provider values or application keys. Its value was not displayed.

Still resource-dependent: actual cluster/bucket/ingress/CA/credentials, fresh managed backup/restore evidence, real Spaces compatibility, domain/TLS/client-IP behavior, messaging delivery, load measurements and hosted acceptance. Purchasing is explicitly pending. A “yes” to the approved worksheet allows that execution sequence; it does not mean those results already exist.

### Local verification, 13 October

- Read-only DigitalOcean preflight: account access verified; configured account inventory contained no registries, apps, managed databases or VPCs. Spaces subscription/bucket inventory was not verified without scoped storage access. No resources were created.
- Deployment renderer: **18 tests passed**, covering immutable provenance, lean pools/sizes, strict TLS/CA validation, private access and provider/secret scope. Single-registry DOCR specs now omit the registry field as required by the current [App Spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/); the release manifest still verifies the actual registry name.
- Backend private-access and migration-safety unit checks: **34 tests passed**. Frontend private-access/matcher/deployment checks: **51 tests passed**.
- All four Linux backend targets built under local `:hosting-preparation` tags. **Eight** actual-image checks passed: process commands, non-root users, certificate handling/rejection, Sharp decoding/encoding, runtime imports, password hashing and document fonts. These are dirty-tree preparation builds with revision `unknown`, not publishable release provenance.
- The built migration image passed a new disposable PostgreSQL 17 test: empty replay of all **58 migrations**, schema/history checks, `pg_dump`, **actual `pg_restore` into a second newly created database**, and checks on the restored schema/history. Pending migrations and intentional drift both blocked the read-only deployment check. Targets were `fixture-postgres:5432/hosting_60e3ce1a8d8a_ci` and `hosting_restore_60e3ce1a8d8a_test` on a newly created internal Docker network, with no host ports/volumes. Only those test containers/network were removed. This proves the isolated schema restore path; it does not prove managed PITR, customer-data recovery, real role permissions or cloud backups.
- Backend typecheck/lint and frontend TypeScript/targeted lint passed. Secret scanning passed. The final frontend production build passed (73 generated pages). The real built Next.js runtime passed private-path and prefetch denial, incorrect-credential denial, authenticated API rewrite, server-side API authentication, login rendering, optimized brand-image loading, denial after the image cache was warmed, secret absence in HTML/response headers, and the private-mode container health check. This used a synthetic API inside a network-isolated disposable container; it does not certify Vercel ingress or a real backend/database integration.

Reproduce targeted preparation checks from the relevant package directory:

```powershell
# backend: build the local targets first; never push these preparation tags.
node --test scripts/deployment/spec.test.mjs
npx vitest run tests/unit/private-testing.test.ts tests/unit/database-migration-safety.test.ts
node --test scripts/deployment/database-release.test.mjs
$env:AAT_IMAGE_TEST_TAG = 'hosting-preparation'
$env:AAT_IMAGE_TEST_REVISION = 'unknown'
node --test scripts/deployment/images.test.mjs
Remove-Item Env:AAT_IMAGE_TEST_TAG, Env:AAT_IMAGE_TEST_REVISION

# frontend: uses only a built local image, a synthetic API and no external network.
npx vitest run tests/unit/private-testing.test.ts tests/unit/deployment-config.test.ts
node scripts/check-private-testing.mjs
```

The initial migration build exposed the Docker context excluding safety scripts; the narrow `.dockerignore` allowlist was corrected and the image rebuilt. The first frontend matcher test used a renamed helper unavailable in the installed Next version; it now uses the installed export. Runtime testing then exposed Next's internal optimizer omitting credentials; only public brand artwork is exempted, while optimized-image requests and all business media remain gated. These findings are included so the evidence does not imply the first attempts passed.
