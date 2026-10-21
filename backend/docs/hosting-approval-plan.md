# Private hosting preparation and public launch path

## Public release preparation - 21 October 2026

The user approved a first public release for **browsing and enquiries**. Checkout, paid reservations and live payments remain unavailable. The user declined an additional recurring production baseline and requested that staging be taken offline so its existing budget can fund production. The separately capped USD1 restore rehearsal was approved. Keep staging data preserved and production database credentials, keys and media separate.

### Revised allocation: staging offline, production within the existing budget

| Resource                   | Configuration                                                                                                    | Monthly baseline                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Production API             | allied-autotech-production; one apps-s-1vcpu-1gb-fixed                                                           | USD10.00                                 |
| Production identity worker | Same app; one apps-s-1vcpu-0.5gb                                                                                 | USD5.00                                  |
| Production general worker  | Same app; one apps-s-1vcpu-0.5gb                                                                                 | USD5.00                                  |
| PostgreSQL server          | Existing allied-autotech-staging-db; separate allied_autotech_production database and restricted roles           | Existing USD15.15                        |
| Registry                   | Existing Basic registry; observed usage approximately 391 MB                                                     | Existing USD5.00                         |
| Media                      | New private bucket allied-autotech-production-5ae8fa4d within existing Spaces subscription; separate limited key | Existing USD5.00 within shared allowance |
| Frontend                   | Existing Vercel Pro project, Production environment                                                              | No additional subscription               |

**DigitalOcean baseline remains approximately USD45.15/month**, or USD65.15/month including the already-purchased one-seat Vercel Pro baseline. Archive the existing staging app before creating the production app, so two paid app stacks do not run together. DigitalOcean currently charges nothing for an archived app; its database continues billing. Preserve the complete staging spec, pinned image digests, private gate and existing database. Do not rename paid components or buy another database server. These estimates exclude tax, deployment-job runtime and usage overages. Stop before any higher recurring allocation or other purchase.

Staging and production have separate databases on one managed server, not separate infrastructure: capacity, administrator access, backup and server incidents are shared. Only production runs normally. Restoring hosted staging later restarts its app charges and needs a fresh cost approval; review connection capacity and resource isolation first. Local isolated testing remains available without additional cloud subscriptions. [Archive/restore behavior and billing](https://docs.digitalocean.com/products/app-platform/how-to/archive-restore/)

A separate temporary managed restore-rehearsal cluster, **up to USD1 total**, was explicitly approved: allied-autotech-production-restore-20261021, removed after verification. Do not exceed that cap. Verify production backup encryption, retention and available PITR, then restore into the separate target and compare migration history, counts, constraints, permissions and critical reads. Never restore over an existing environment.

Pricing checked on 21 October: [App Platform](https://docs.digitalocean.com/products/app-platform/details/pricing/), [PostgreSQL](https://www.digitalocean.com/pricing/managed-databases), [Spaces](https://docs.digitalocean.com/products/spaces/details/pricing/). Storage allowances are shared; alerts do not cap spending.

### Prepared implementation

- [Production App Platform template](../ops/digitalocean/production.app.yaml.template): existing image targets/sizes, strict database TLS, separate runtime/migration roles and read-only PRE_DEPLOY check. Missing real production credentials and digests deliberately prevent deployment. Do not run the staging renderer against production.
- [Production input example](../ops/digitalocean/production-inputs.example.json): blanks only for credentials. Fresh cryptographic keys and private prelaunch access were prepared separately under the ignored ops/digitalocean/.private/production directory; existing staging keys were preserved.
- Backend PUBLIC_LAUNCH_MODE=browse_enquiries blocks customer writes to carts, orders, bookings, payments, vehicle transactions and inspections, including direct API requests. Staff/admin authentication and customer-care checks remain intact. Startup rejects enabled payment providers/reconciliation in this mode.
- Frontend NEXT_PUBLIC_PUBLIC_LAUNCH_MODE=browse_enquiries replaces purchase/inspection actions with enquiries/WhatsApp, changes fixed-service booking forms to enquiries while retaining prices, removes cart links and redirects transactional dashboard pages to contact. Rebuild when changing this public build setting. Default full mode preserves staging behavior.
- [Catalogue review](../ops/digitalocean/production-catalogue-review.json): the 14 service names explicitly supplied in the original business brief, quotation-required, with no invented price/duration. This is a proposal, not an import. No products/vehicles are invented. Current staging public lists were observed empty; never copy staging seed data, customers, passwords, policy approvals or financial history into production. Publish real owner-reviewed records only.

### Domains and held DNS changes

alliedautotech.com and www.alliedautotech.com are registered and ownership-verified on the existing Vercel project. Web DNS remains unconfigured. Staging and all Google Workspace/Resend records are preserved.

Only after the correct new production deployment is ready, configure these DNS-only Cloudflare records. The current Vercel project-domain API supplied these rank-1 targets; recheck at cutover.

| Type  | Name | Target                                              | Status                                    |
| ----- | ---- | --------------------------------------------------- | ----------------------------------------- |
| A     | @    | 216.150.1.1                                         | Hold until cutover                        |
| A     | @    | 216.150.16.1                                        | Hold until cutover                        |
| CNAME | www  | e59765530a95057a.vercel-dns-017.com                 | Hold; redirect www to canonical apex      |
| CNAME | api  | Actual new production App Platform ingress hostname | Retrieve after app creation; do not guess |

Canonical frontend: https://alliedautotech.com. Intended backend: https://api.alliedautotech.com. Register the API domain with its production app and verify TLS before setting Vercel BACKEND_ORIGIN. Keep browser requests same-origin through rewrites, cookies host-only/Secure/HttpOnly, exact CORS origins and production bucket CORS/host allowlists. Keep Google MX/SPF/DKIM/domain verification and Resend/DMARC records unchanged.

### Dependency order

1. Follow the revised budget allocation: no second recurring PostgreSQL server and no simultaneous paid staging/production app stacks. The user approved up to USD1 for the temporary restore rehearsal. No production paid resource was created during preparation.
2. Recheck the existing cluster and fresh backup evidence; create a separate empty production database with dedicated runtime/migration/backup roles. Preserve all staging databases, data and grants. Initialise production using the guarded migration workflow with actual target confirmation and db:check. Archive staging only when the production release is ready to deploy, then create the production app within its released USD20/month allocation. Stop on a provider quote above the approved budget.
3. Obtain a separate production Resend sending key restricted to notify.alliedautotech.com and a bucket-limited production Spaces key. Save directly in the ignored production directory. The existing sending-only Resend credential cannot create another key; no new mail subscription is needed.
4. Deploy reviewed immutable images with fresh private prelaunch access and disabled indexing. Populate/review real catalogue content. Register and verify the selected owner normally in production, then guarded bootstrap/MFA; do not copy the staging account/password. Verify staff receiving/replying through department Groups. Live probes use only the designated tester.
5. Verify actual managed backup/restore, TLS/firewall/least privilege, private media/upload/cleanup, staff/MFA, enquiry receipt and representative load. Compilation and health checks alone do not certify external services.
6. Obtain owner acceptance of content and the customer-care/privacy notice. Apply only the approved browsing launch: remove the gate from production frontend/API, enable canonical indexing and cut over the held DNS. Keep staging private and payments/SMS/marketing/destructive retention disabled.
7. Record deployed commits/digests, costs, checks, operating contacts and compatible application rollback/recovery steps. Do not declare launch complete before the public hostname and enquiry-response path work.

The owner already specified prices excluding VAT, 7.5% added after discounts to products/services and both delivery types. Do not ask them to repeat that instruction. Remaining invoice/accounting details, reservation agreement/hold rules, delivery areas/fees, cancellation/returns, refund timing, workshop capacity and staff/policy mappings still block their associated transactional workflows. Browsing approval does not approve those policies.

### Verification status

The release is based on staging source c2b0548 plus the browsing/enquiry controls;
the newer workforce branch is excluded. No cloud database was used for test writes.

- Fresh PostgreSQL 18 `_ci` migration replay, db:check and guarded-owner suite
  passed. The broad backend run passed 1,201 tests; seven suites encountered
  Docker forwarded-port target checks. Without changing those guards, all seven
  passed on a new isolated database through its internal loopback connection
  (35 tests). One intermediate rerun encountered retained synthetic promotion
  fixtures; the final new-database run passed. No test data was deleted to pass.
- Frontend: all 643 unit tests passed; the browse/enquiry production build passed;
  six real Edge browser checks passed at desktop/mobile sizes, including approved
  customer-care hours/response wording and no cart/booking/reservation actions.
  Browser plugin unavailable; installed Playwright was used. Screenshots are
  outside the repository under the local temporary directory.
- Backend typecheck, script checks, lint, secret scanning, OpenAPI validation
  (270 paths), mounted route coverage (323 operations), and 31 deployment-spec
  tests passed. Recovery and existing migration-guard unit tests passed (30).
- A new isolated initial-failure recovery rehearsal passed normal guarded
  migration of all 59 migrations and an actual restore into a second `_ci`
  database, followed by db:check. See the separately approved
  [production recovery](production-initial-migration-recovery.md).
- The actual production bucket is private; its scoped key passed owned-object
  upload/read/removal. Anonymous listing returned 403; CORS preflight returned
  only https://alliedautotech.com. The temporary provisioning key was revoked.
- Managed PITR restore into the approved temporary cluster matched staging's
  83 tables/59 migration records and production's preserved failed-initial
  state over strict TLS. The temporary cluster was deleted and deletion verified.
  The source firewall was restored. Production recovery and final deployment
  evidence must be recorded separately; this check preceded recovery.
- Staging credentials exposed accidentally during inspection of an old restore
  record were rotated, including the operator credential; operator login with
  the replacement was verified. No production credential was exposed in that
  record. Staging's saved spec was updated with replacement secrets and archived;
  its active archived deployment was verified. Its database/data were preserved.

Production recovery then completed all 59 migrations through the guarded runner,
passed final db:check and runtime/backup least-privilege checks, verified a fresh
post-migration backup and restored the original firewall. No staging data was
changed. Production image/deployment, owner provisioning,
public DNS/TLS, catalogue acceptance, enquiry email delivery, privacy text and
representative hosted load checks remain release gates. Do not call the public
launch complete from local checks alone.

Historical private-testing plan, prepared 13 October 2026: on 17 October, Mike approved the $45.15/month DigitalOcean baseline for private owner/staff testing, keeping the frontend on Vercel and public access/live payments disabled. A separate staging restore-test cluster was approved up to $1, with removal after verification. The 21 October browsing/enquiry launch approval and proposed additional production purchases are recorded above; transactional policy publication remains unapproved.

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
