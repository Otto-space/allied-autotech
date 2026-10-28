# Discovery, fitment, saved garage and notification review

Review branch: `feat/discovery-fitment-20261023`. Implementation is isolated in
`C:/Users/PC/.codex/worktrees/allied-discovery-fitment-20261023`.
Implemented and deployed to [alliedautotech.com](https://alliedautotech.com) on
24 October 2026 after the user's explicit production authorization. This is an
application implementation, with no PDF conversion. The main checkout's application
code and independent edits are preserved; its tracker receives only an appended
release handoff. See [checkpoint evidence](discovery-fitment-implementation.md)
for the chronological record and the final verified release below.

## Requirement coverage

| Requirement                 | Implemented behavior and principal locations                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vehicle condition           | `vehicles.schemas.ts`, `vehicles.repository.ts`, `vehicle-filters.tsx`: new, foreign used and locally used are explicit; legacy USED remains origin unspecified. Multiple condition choices match any selected choice.                                                                                                                                                                                                                                             |
| Actual assembly origin      | Shared reviewed ISO country reference and UN M49 Europe; searchable accessible country field, common aliases, shortcuts and region conflict handling. No origin inferred from manufacturer headquarters or import location. Unknown stays unknown.                                                                                                                                                                                                                 |
| Powertrain and drivetrain   | BEV, HEV, PHEV and ICE remain separate from fuel and FWD/RWD/AWD/4WD. Multiple powertrains are available with concise explanations. Legacy fuel values are not backfilled into powertrain.                                                                                                                                                                                                                                                                         |
| Vehicle search              | Existing listing API/repository extended for make/model, trim, prices, exact year/year range, mileage, transmission, fuel, body, engine capacity, seats, colour, genuine recorded features and actual condition-report presence. Make/model options depend on published listings; changing either clears obsolete trim. Public listings remain AVAILABLE only.                                                                                                     |
| Vehicle results and UX      | Count/filter/page reads share a consistent snapshot; seven stable sort orders, filter-bound signed cursors, null mileage handling, URL history, per-choice chips, clear all, responsive filter panel, visible validation, skeletons and accessible controls.                                                                                                                                                                                                       |
| Product discovery           | Existing catalogue reused for product name/SKU/manufacturer part number, brand, type, stored condition/classification, inclusive price ranges, actual unreserved active-branch stock and stable sorts/counts. No invented discount or rating controls.                                                                                                                                                                                                             |
| Category/subcategory        | Existing Category gains a two-level parent relation. Public main category and dependent subcategory are searchable and independently clearable. Root selection includes root products and active children; selected child requires the stated parent. Changing parent clears child and paging. Inactive ancestors hide descendants.                                                                                                                                |
| Normalized vehicle identity | `VehicleMake`/`VehicleModel` registry is independent of sale inventory. Model/year boundaries and source references are managed by scoped staff; customer garage records can explicitly link without guessing legacy names.                                                                                                                                                                                                                                        |
| Reviewed fitment            | Existing compatibility rows extended with bounded years, configuration qualifiers, required missing details, inclusion/exclusion, evidence, author/reviewer, version and semantic duplicate fingerprint. APPROVED needs independent technical review. Editing demotes, retirement preserves evidence, append-only history records changes. Existing rows default to draft.                                                                                         |
| Fitment decisions           | `fitment.engine.ts` drives public and PostgreSQL eligibility consistently. Verified fit, needs verification, not compatible and unknown stay distinct. Exclusions override inclusion; missing required qualifiers never become wildcards. Safety-critical braking rules require position/technical specifications; universal scope is limited to explicitly recorded accessory types.                                                                              |
| Find parts for my car       | Make/model/year picker and optional relevant specifications feed server-side candidate/verified searches before count/paging. Product details retain context, show evidence-appropriate explanations and offer Request the right part, including on no confirmed match. Anonymous manual search remains available.                                                                                                                                                 |
| Saved garage                | Existing owned CustomerVehicle CRUD/media/booking relations reused for nickname/default/technical configuration, edit/remove/switch and applying to parts search. Owner locks serialize defaults; stale edits roll back. Foreign access is denied. VIN, registration, nickname and account IDs are excluded from public search links.                                                                                                                              |
| Staff controls              | Existing product/category editors gain fields. `/admin/fitment` provides scoped authoring and independent technical review/history. Existing workforce capabilities, branch/assignment checks, MFA, CSRF, versioning and audit are enforced server-side. UI visibility does not replace authorization.                                                                                                                                                             |
| Collection                  | New checkout accepts collection only and rejects delivery before reservation. Existing delivery/financial snapshots remain readable. Existing uncertain-request/idempotency safeguards are retained. Catalogue search does not enable paid features or providers.                                                                                                                                                                                                  |
| Notification targets        | Existing notification resource identity is resolved through allowlisted routes and current record access. Recipient, branch, responsibility, assignment, message visibility and expiry are rechecked. No arbitrary stored URL is trusted. Unresolvable legacy notices remain manually manageable.                                                                                                                                                                  |
| Sidebar and queues          | Actual authorized actionable counts annotate destinations and collapsed ancestors. One distinct record opens its context; multiple records open a paged Needs attention queue with individual links and a normal full-page route. Expand-only parent controls retain their purpose.                                                                                                                                                                                |
| Context and read state      | Exact successful record views show/focus contextual content, including off-page payments/bookings and older support messages. Read acknowledgement waits for displayed content in a visible tab; support messages must enter view. Lists, errors, hidden tabs, unrelated records and session races do not acknowledge. Read is idempotent, preserves first read time, supports manual controls and refreshes counts across tabs without completing business tasks. |
| Branding                    | Active web, email, notification/action and newly generated document copy uses Built on trust driven by quality. Superseded design instructions were corrected. Previously persisted financial/audit snapshots remain untouched.                                                                                                                                                                                                                                    |

## Changes and contracts

The [change manifest](discovery-fitment-change-manifest.txt) lists repository paths
changed since the implementation baseline `2d5021dc`. Reused building blocks include
Prisma/Zod repositories, existing catalogue/customer garage, workforce permissions,
notification storage/broadcast, session/CSRF, audit, media and idempotent financial
operations. No competing UI library or external fitment dataset was introduced.

Two additive forward migrations accompany the Prisma schema and generated client:

- `20261023120000_vehicle_discovery_attributes`: condition enum additions, nullable
  assembly country/powertrain/engine capacity, recorded feature array and indexes.
- `20261023130000_reviewed_parts_fitment`: normalized registry, product/category
  attributes, garage configurations, compatibility review/evidence/qualifiers,
  duplicate/review constraints and immutable history.

No applied migration was edited. Existing unknown records are neither guessed nor
promoted to approved fitment. The schema guard uses an empty OR probe to validate
real generated columns without reading business rows; the real missing-column test
checks the custom mismatch error and transaction rollback.

Public contracts extend `/public/vehicles` and its existing discovery/facets,
`/public/catalog/products` and discovery/facets, and category reads (including
`rootOnly`, `parentId`, literal prefix `search`). Vehicle `conditions`/`powertrains`
accept distinct comma-separated values, OR within each field and AND across fields;
singular parameters remain compatible but cannot accompany their plural equivalent.
New `/public/fitment` and scoped `/staff/fitment` operations cover registry/rules and
decisions. Owned garage operations carry explicit normalized configuration/default
state. Notification destination/context/read-context and exact workforce booking
reads support scoped arrival. OpenAPI JSON, endpoint handbook and frontend generated
API types are synchronized; consult these artifacts for exact schemas and routes.

## Verification maintenance

The fresh audit found published advisories after the earlier checkpoint. This branch
pins Next.js/eslint-config-next 16.4.3 and Zod 4.6.6, and updates the compatible
backend body-parser 2.4.0, its qs dependency 6.16.1, and fast-uri 3.1.9 lock entries.
Other worktrees' installed dependency targets are preserved. The frontend's fresh
production dependency audit passes with zero reported vulnerabilities. Backend
installed production dependency audit also passes with zero reported vulnerabilities.
These results exclude development-only dependencies.

Sources: [Next.js image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[Next.js cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[body-parser advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828),
[fast-uri advisory](https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg).

Prettier now accepts existing source line endings through `endOfLine: auto`.
Existing explicit migration line-ending rules remain intact: all 64 files were matched against their
recorded isolated replay checksums, and db:check passed afterward. No migration
content or database migration history was changed. Five existing frontend files
received formatting-only fixes; the current framework lint also required escaping
visible quotation marks and allowing intentional CommonJS imports in .cjs utilities.
Browser fixtures now wait for the settled initial search URL, use the reviewed
fitment UI, and follow keyboard focus through the new subcategory control.

## Final validation

- Final new PostgreSQL 18 target: `127.0.0.1:63888`,
  `allied_release_20261024182516_6bef5322f5d7_ci`. Actual server identity, port,
  database and private cluster directory were verified, with zero public tables
  before replay. `NODE_ENV=test`, matching `TEST_DB_NAME`, loopback-only SSL
  disablement and the required empty-database confirmation were explicit.
- All 64 migrations replayed from empty; Prisma schema comparison and `db:check`
  passed. The client was regenerated and backend/API/worker images built.
- Full backend: **179 files passed, 37 skipped; 1,422 tests passed, 156 skipped,
  zero failures**, across 216 files / 1,578 tests. Skipped provisioning, historical
  workspace-fixture, singleton-owner and empty-queue cases were not executed.
  See [the fixture gates](../tests/helpers/database.md).
- Frontend: **146 files / 985 tests passed**, plus full lint, route types,
  TypeScript, optimized Next.js 16.4.3 build and formatting. A merged Markdown
  formatting issue was fixed and the complete formatting check passed afterward;
  the pushed frontend's full GitHub release workflow also passed.
- Final combined browser acceptance: **168 passed, zero failed, skipped or flaky**.
  This covers vehicle/shop filters, category hierarchy, fitment staff/customer
  workflows, saved configurations, garage galleries, notifications, financial
  recovery and missing-page navigation. Screenshots were reviewed. Synthetic
  browser requests were intercepted; server authorization was tested separately
  against real isolated PostgreSQL.
- Runtime-role integration passed: a newly created transaction-local role exercised
  schema probes and ordinary CRUD, with no ownership/DDL/TRUNCATE/admin privileges.
  Its role, grants and records were rolled back and removal verified. Existing
  runtime grants were not changed.
- Release configuration and actual image checks: **41 passed**. The exact migration
  image also passed isolated empty replay, schema/history checks, separate restore,
  pending-migration rejection and real drift rejection. No cloud restore is claimed
  by that container test.
- OpenAPI validates **347 paths**; coverage matches **407 operations plus four
  infrastructure routes**. Frontend API types are regenerated.
- Both installed production dependency audits report **zero vulnerabilities**.
  Development-only dependencies are outside that audit result. The local secret
  guard passed for 2,994 non-ignored files; the pushed repository guard passed too.

The service-search plan fixture now provides its own unrelated 10,000-row baseline
alongside its 10,000 searched records. This removes reliance on other test files
running first, while preserving the normal planner and the actual index-use
assertion. PostgreSQL legitimately chose a 5.7 ms sequential scan on the earlier
smaller fixture; the final independent fixture used all three search indexes.
See [PostgreSQL EXPLAIN guidance](https://www.postgresql.org/docs/current/using-explain.html).
Complete backend runs use a new isolated database because several legacy fixtures
intentionally retain their synthetic records after their suite ends.

The migration guard recognizes complete, argument-free `CREATE TRIGGER ... BEFORE/
AFTER TRUNCATE ... EXECUTE FUNCTION ...()` declarations as protective DDL. Actual
TRUNCATE, destructive statements beside the declaration, destructive function
bodies and dynamic execution remain blocked. All 27 focused migration-safety tests
and the final complete backend suite passed. No applied SQL or migration ledger
was rewritten to resolve this false positive.

GitHub outcomes:

- [Backend database safety, including the original real missing-column test](https://github.com/Otto-space/allied-autotech/actions/runs/40120672528): success on `7bb485b8`.
- [Frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40119714283): success on `e2143b56`.
- [Repository secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40120672523): success.

## Production release - 24 October 2026

The verified source is `7bb485b8a3cd72039ff25f0f83c9a53ab9f90e48`, pushed on
`feat/discovery-fitment-20261023`. Backend images were built from clean
`59d5141b965d20ae625df678b523992648d46322`; the later backend changes are limited
to two release/test fixtures excluded from the image context. Frontend deployment
source is `e2143b56992ba8afda1100921cac94e2f0cc855a`; the later commit changes only
a backend test. Runtime source equivalence was checked before production writes.
The newer live gallery, branding, missing-page and support-procedure work was
merged rather than overwritten.

### Database and recovery gates

The actual target was confirmed as
`allied-autotech-staging-db-do-user-44970995-0.k.db.ondigitalocean.com:25060/allied_autotech_production`,
with `NODE_ENV=production` and strict certificate/hostname verification. The managed
server's historical staging name does not identify the selected database: production
and staging remain separate databases. Staging data was not modified.

Actual separate runtime, migrator and backup roles authenticated successfully.
Runtime ownership, schema CREATE, TRUNCATE, superuser, role-creation, database-
creation and RLS-bypass checks were false. API and both workers use the restricted
runtime role; the migration job uses the migrator. Existing grants were preserved.

The provider API listed eight daily managed backups at preflight; the latest,
`2026-10-24T05:22:10Z`, was confirmed again before rollout. Managed encryption,
seven-day retention/PITR and the earlier separate managed restore receipt were
reviewed against the [provider's backup features](https://docs.digitalocean.com/products/databases/postgresql/details/features/)
and [restore procedure](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/).
No new paid restore cluster was created for this release.

A fresh dedicated-role production archive was actually restored into the newly
created isolated `allied_restore_20261024_cecc5293004d_ci` database on
`127.0.0.1:63888`. All **86 restored tables** and prior migration history matched;
the two forward migrations rehearsed successfully from 62 to 64, with existing row
counts preserved. This is a logical archive restore rehearsal, not a new managed
PITR restoration. The source was not written during that rehearsal.

Immediately before the production migration, a new dedicated-backup-role archive
and exact-target SHA-256 receipt were created and verified in protected durable
storage. Only `npm run db:migrate` applied the two reviewed additive migrations.
It completed at `2026-10-24T18:44:22.402Z` with all 64 migrations compatible.
The subsequent `npm run db:check`, live zero-business-row Prisma schema probe,
runtime privilege checks and new-table SELECT/INSERT permission checks passed.
Existing business row counts were preserved. No production CRUD fixture was used.
The original app-only database firewall was restored and verified at
`2026-10-24T18:44:24.811Z`. No reset, truncate, restore-over-live, history resolution
or existing grant change was performed.

### Application promotion and observed checks

DigitalOcean deployment **`5c1ea9a7-6211-46d2-995f-c45e504bf9e9` is ACTIVE**, with **16/16 successful
steps**, its read-only predeploy database check successful and all four immutable
image digests verified:

| Component       | Digest                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| api             | `sha256:0b1f97679c40f23c7f17295fa9f72a8d139844a83920f6c19ea766197376c517` |
| identity-worker | `sha256:481c287a4c40ccf255e024181c8cff941aa8e1795cacba8a880ac4ce1a08744c` |
| general-worker  | `sha256:15da59954819498a037ee756816c36394cd484aca23c8547db1f8396cfc2e970` |
| migrate         | `sha256:4e5db5a7cb6305cad035bb444b7be92f6f3bc5a7871a4c508dd51bdc2d54082b` |

Only those four digests changed in the app specification. Component sizes, existing
secrets, launch policy, provider settings and deployment safeguards were preserved.
No new recurring resource or subscription was purchased.

Eight live backend GET checks passed: liveness/readiness, normalized fitment makes,
root categories, product discovery and the combined multi-condition/multi-powertrain
vehicle query returned 200; anonymous owned-garage and staff-fitment reads returned 401. No production business fixture, order or external message was created for
verification.

Vercel deployment **`dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr` is READY**. It was built with
automatic custom-domain promotion disabled, then promoted after the database/API/
worker checks. Separate management-API inspections confirmed that both
`alliedautotech.com` and `www.alliedautotech.com` resolve to this exact deployment.
This verifies provider state and domain assignment; it is not a fresh authenticated
hosted UI walkthrough. The 168 browser scenarios are the isolated rendered tests
recorded above.

### Recovery and remaining operational acceptance

Retain the previous backend deployment `92fb65ee-dfc7-4a81-9124-92f4913574c7`,
previous frontend `dpl_GaG2tZE9e7YbQ1U2pSq7LnHGxUcS`, protected backups and private
receipts. Stop promotion on failed verification; diagnose and fix forward. An
application rollback requires checking compatibility with records and enum values
created after this release. Keep the additive schema and never reset, delete or
resolve history to downgrade it. Any destructive recovery needs separate exact-
target authorization and a successful separate rehearsal.

Staff still supply genuine assembly/specification data and manufacturer fitment
evidence. An author and independent technical reviewer must approve actual rules;
synthetic Corolla/brake examples do not establish real suitability. The accepted
Support-email and garage-gallery paths in the main tracker remain settled. Site
completion Item 6's staff-managed media and future real catalogue publication, and
the other operational/policy items, retain their recorded scope and status. Paid
checkout/providers remain under the existing browsing-and-enquiries launch policy.

### Bounded local Docker cleanup

The current deployment and its two preceding successful deployments were reviewed
from the provider. Nine distinct component digests were protected. The sole removed
reference was the task-created, never-deployed API build
`allied-autotech-api:032fe09cd5516ec47fe495353a30837521c9eb80`, superseded by the
verified release. Its identity/revision, sole tag, lack of container references and
absence from active worktree HEADs were rechecked immediately before native
`docker image rm`, without force.

Unique local images changed from **33 to 32**.
Rounded Docker image usage remained 10.3 GB because useful layers are shared.
Host C: free space measured **18,965,118,976 bytes before** and
**18,964,123,648 bytes after**; no physical-space reclamation is
claimed from that change. All **13 containers and 14 volumes** retained their
identities; all nine protected image digests were reverified. Warm caches, useful
base/tool images, backups and other worktrees' resources were retained. The user's
independent Docker-hygiene edits were preserved.
