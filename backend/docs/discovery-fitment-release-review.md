# Discovery, fitment, saved garage and notification review

Review branch: `feat/discovery-fitment-20261023`. Implementation is isolated in
`C:/Users/PC/.codex/worktrees/allied-discovery-fitment-20261023`.
This implements the pasted requirements as application changes. The user explicitly
authorized production deployment on 24 October 2026, after verification. No PDF
conversion is involved. The main checkout and its independent work remain
untouched. See [checkpoint evidence](discovery-fitment-implementation.md) for the
chronological validation record. Final validation is being completed below.

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

## Validation record

- Fresh local PostgreSQL 18 target: `127.0.0.1:63888`,
  `allied_release_20261024171300_0c3c71d20c25_ci`, NODE_ENV=test, matching TEST_DB_NAME,
  SSL disabled only for the loopback private cluster. Actual server address, port,
  database, cluster directory and initial empty state were verified before replay.
- Full 64-migration empty replay, schema comparison and `npm run db:check`: passed
  on 24 October 2026. This is isolated verification, not a staging migration.
- Full backend regression: pending final result.
- Runtime role/schema/CRUD and privilege checks: pending final result. The test
  creates a new transaction-local role/grants and rolls everything back; it does
  not change existing runtime or migration grants.
- Frontend production pipeline: passed lint, route types/TypeScript, 146 files /
  985 tests, optimized Next.js 16.4.3 build and formatting. Frontend and backend
  production dependency audits each report zero vulnerabilities.
- Final vehicle/shop/fitment/garage/notification browser run: 90 passed, zero
  failed, skipped or flaky scenarios. Synthetic browser requests are intercepted; server correctness/authorization is tested separately
  against real isolated PostgreSQL.
- Earlier completed checkpoints include 25 clean notification/payment browser
  regressions, 39 collection scenarios across focused runs, scoped fitment staff
  author/reviewer scenarios and saved-garage ownership/race/browser checks. Exact
  checkpoint counts and limitations are in the implementation evidence document.

The shared backend suite deliberately gates singleton-owner provisioning and empty
operational queue/scan scenarios; do not describe intentional skips as executed.
See [isolated verification instructions](../tests/helpers/database.md). No deployed
provider delivery, staging runtime permissions, off-device backup setup, PITR or
restore rehearsal has been certified by these local checks.

## Authorized production release sequence

1. Review this branch against the current backend/frontend release sources and
   resolve independent intervening changes before choosing release commits. Preserve
   the ongoing site-completion tracker and support-email acceptance work.
2. Use the verified production target through the local/release secret store; confirm
   actual host, port, database and environment. Use separate least-privilege runtime,
   migration and backup credentials. Review real grants rather than copying test
   privileges or using the local migration administrator for application traffic.
3. Before any shared rollout, verify automated encrypted off-device backups,
   retention/PITR where supported, and rehearse a restore into a separate database.
   Record recovery point/time and the reviewed forward/recovery plan. These were
   not performed for this local feature. A local dump or archive listing is
   insufficient evidence.
4. Re-run complete empty replay and relevant regressions on a new isolated target
   for the exact release commit. Regenerate Prisma/API types and build frontend,
   backend and workers. Review the two additive migrations and SQL-only controls.
5. Use only `npm run db:migrate` with reviewed pending migrations and verified fresh
   backup/history checks. Stop on wrong target, drift, checksum/history/backup or
   verification failure. Never reset, db push, resolve, restore over data or edit
   an applied migration to bypass failure. Diagnose and fix forward.
6. Run `npm run db:check` against the intended target and verify schema reads and
   necessary operations using the actual runtime/worker roles. They must not own
   tables/database or have DDL, TRUNCATE, superuser or role-creation privileges.
   Promote matching API/workers before frontend, preserving existing release gates.
7. Have scoped staff enter real assembly/specification information and a reviewed
   catalogue source. Demonstrate an author and an independent technical reviewer
   with actual manufacturer evidence before publishing any Corolla/brake-pad claim.
   Synthetic Toyota Corolla 2018 examples prove behavior only, not real suitability.
8. Smoke-test public and signed-in search, garage isolation, scoped staff actions,
   collection policy, notification arrivals/counts and historical document reads on
   desktop/mobile. Observe logs and read-only verification. Roll application code
   back only when compatible; database correction remains a reviewed forward action.

No new owner decision is needed to keep unknown data unknown or to retain the
existing launch/payment/provider policy. Operational owners still need to supply
and review genuine catalogue evidence, actual release credentials/permissions and
backup/restore acceptance. Existing support-email/provider acceptance is separate.
Production deployment is explicitly authorized after the required gates pass.
External messages, live payments, purchases and destructive database operations
are outside this authorization. The deployment record below must reflect actual
provider results before the release is described as live.
