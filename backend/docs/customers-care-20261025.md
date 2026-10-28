# Customers and Customer Care acceptance contract

Baseline: released `71d3f60d`, reused worktree, branch
`feat/customers-care-20261025`. Released notification changes through `17bc43fc`
were merged before implementation acceptance; their production runtime is `345847d5`.
The actual directory is `WorkCustomers`, not the unused `CustomerDirectory`.
Existing account enums, authentication gates, review, drafts, customer ownership,
managed workforce scopes and support email observations remain authoritative.

## Bounded batches

1. Contracts and isolated fixtures; account transition and delivery-dismiss APIs.
2. Actual customer table/detail, copy controls and shared semantic states.
3. Conversation-first legacy/managed/customer care and focused creation.
4. Permission/session/audit, migration, rendered/responsive and regression checks.

## Mutation contracts

- `POST /admin/customers/:customerId/account-status`: MFA-verified administrator,
  CSRF, `{expectedStatus: ACTIVE|SUSPENDED, status: ACTIVE|SUSPENDED, reason}`.
  Reason 10–1000 characters. Lock/revalidate actor/session and target User; current
  CUSTOMER role required. Conditional transition rejects stale/already changed
  status with 409. DEACTIVATED accounts are outside this operation. Suspension
  revokes sessions and unused reset/verification tokens transactionally with audit.
  Reactivation never restores sessions/tokens. No outbound notification policy added.
- Delivery dismissal: explicit visible `{notices:[{id,revision}]}` (1–20 unique).
  Existing case authorization before any delivery access; managed workforce uses
  its current responsibility and branch/assignment scopes inside its transaction.
  Each stable revision hashes delivery status/reason/attempt and provider observation
  status/time, never a fetch timestamp. Only attention notices are eligible.
  Persist per operator/delivery/revision; repeat is safe; stale/foreign/not eligible
  rejects the entire bounded batch, never silently reports partial success. History,
  attempts, observations and delivery state remain unchanged. New material revision
  is independently visible. No resend/retry permission is granted.

## Isolated acceptance cases

Fixtures: long identities, missing contact/address, active/suspended accounts,
customer promoted before mutation, Admin/Super Admin, CS, foreign branch and
unrelated technician, public/internal messages, old/new failure attempts.

- Real table headers/cells, explicit View details; copy does not navigate.
- Full value intentionally copied after successful secure clipboard write; denied
  clipboard has no false success and supports manual selection. Focus/touch access.
- Directory query and cursor trail survive detail/back. No invented totals/activity.
- Admin/Super Admin transitions; denied CS/customer; current-role/stale/concurrent
  checks; audit actor/target/reason/before/after; revoked sessions stay revoked.
- Sign-in/protected/MFA and session rotation enforce suspension; no federated sign-in
  exists in the current identity module. Test without any real customer operation.
- Dismiss persists across reads/reload, operator isolation, new revision resurfaces,
  scope denial, atomic stale batch failure, retained history and failure badge.
- Public/internal separation, draft restoration and listing-less Vehicle contracts
  remain unchanged. Conversation and next action precede technical disclosures.
- Render 360/390/768/1024/1440, desktop 1366×768, keyboard/focus/zoom, readable
  contrast and no page overflow. Fixtures are not real operational acceptance.

## Implementation and compatibility

Runtime backend/image source: `dc0322f0fd68df99c45971ea325036dc397e2b2f`.
Frontend source: `fd19aabc9d0a0843857821cf2eb12651f2ce505c` (final detail-only batch).
Subsequent commits extend fixtures and evidence; runtime source equality is checked
before rollout. Existing notification, Shop/Vehicles, home and launch restrictions
are preserved. No application data, existing grants or applied migrations changed.

The new migration `20261025170000_support_delivery_notice_dismissal` adds only
`SupportDeliveryNoticeDismissal`, its composite key/index and foreign keys. Existing
account states need no new enum. Old clients tolerate the optional notice fields;
the new UI requires the dismissal API and migration before promotion. Both legacy
support and managed workforce routes retain their existing authorization boundary.
Sales-only and technician readers gain no contact projection or provider powers.

Shared `status-progress.css` consumers now use explicit domain mappings: successful
outcomes green; informational/in-progress blue; pending/attention amber; suspended/
failed/blocked red; closed/inactive/unknown slate. Provider accepted remains blue;
delivery is green only with an actual observation. Account and email-verification
states remain separate. This changes shared presentation, not unrelated layouts.

## Verification evidence

- [Frontend locked release CI](https://github.com/Otto-space/allied-autotech/actions/runs/40227020772):
  1,024 tests / 155 files, lint, types, formatting, production build (Next 16.4.3)
  and production dependency audit passed; production audit found zero vulnerabilities.
  The install reports development dependency findings; zero is not a whole-tree claim.
- [Backend database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40225766324):
  full 71-migration replay, `db:check`, types/scripts/lint, 60 database safety units,
  the real missing-column guard case, seven public-enquiry checks, 58 catalogue/
  vehicle checks and 46 customer/auth/care integration checks passed.
- Local final merged-source exact-loopback restricted-runtime integration rerun:
  **55 passed / six files** (46 customer/auth/care plus nine compatibility cases).
  These use real isolated PostgreSQL and HTTP requests,
  including suspension/session/audit races, current target role, scoped dismissal,
  per-operator persistence, stale batches and 425 provider observations for one email.
- Broad local backend run: 1,470 passed, ten failed, 154 skipped / 227 files.
  All failures were investigated: serial rerun of four suites passed **66/66**
  (shared global-count, planner/statistics and time fixtures); existing family-field
  fixture correction passed **16/16**; delivery-query mock correction passed **19/19**.
  This is a broad run plus successful focused reruns, not a claimed single all-green
  run. No database constraints or production behavior were weakened for these tests.
- Route/OpenAPI checks: **415 operations**, four explicit infrastructure routes,
  **355 paths**. Restricted native fixture `db:check` passes with 71 migrations.
- All four immutable API/identity-worker/general-worker/migration images run as
  non-root and passed generated-client, live-schema/native-module or migration-check
  contracts against the new isolated Docker PostgreSQL target; remote digests pushed.
- Protected compiled candidate `dpl_BVUgeibwBeTL3EvTZPiiCM9nMNgf`:
  **15/15** new Edge browser scenarios passed. Real rendered table/copy/menu,
  directory return state, Admin/Super Admin review, delivery failure/history/reload,
  separate creation drafts, scoped managed CS and responsive states were exercised
  with isolated HTTP fixtures. Normal scenarios had no console/runtime errors;
  scoped Axe checks and measured badge contrast passed. Main/www were not promoted
  by creating the candidate. Each temporary review key was revoked afterward.
- Conversation regression run on the earlier candidate: **60/61** passed. The
  remaining old assertion assumed technical details were always expanded. The
  Details shortcut was corrected to open its disclosure, and all six focused
  role/audience/outage/responsive checks passed on rebuilt source. Thus all 61
  distinct conversation regressions passed across the full run and focused rerun;
  this is not a claimed single 61/61 run. Customer/care code was preserved by the
  subsequent compatibility-only merge. On final merged source the additional
  **13/13** compatibility editor browser scenarios passed, including stale writes,
  draft recovery, safe preflight retry, mobile layout and accessibility.
- Final detail-only batch: **19/19** complete customer-detail browser cases passed,
  including Admin/Super Admin facts, Staff denial, malformed/mismatched responses,
  independent activity scopes/paging, outages, garage context, foreign currencies
  and seven responsive widths with Axe checks. The closed address disclosure no
  longer stretches to the contact card's height; garage rows never render payment
  fields. The original generic fixture incorrectly supplied order data for the
  Garage tab. It now supplies a garage-shaped record, and the predecessor baseline
  was recaptured with that same synthetic fixture before the final after captures.
  All 15 new acceptance cases also passed again on this final compiled candidate.

## Recovery and safety evidence

A fresh production archive was restored into a **new separate** protected local
database. All 89 original table hashes and the 70-migration ledger matched. The
guarded 70-to-71 migration then passed with the original data/ledger preserved.
Nine managed backups and the latest backup timestamp were checked alongside the
documented encrypted off-device retention/PITR configuration. This was an actual
logical restore and forward-migration rehearsal, **not a fresh managed physical
PITR-cluster recovery**. A fresh target-verified backup is still required by the
protected production migration runner immediately before application.

## Screenshots and limits

Synthetic before/after captures are in
`C:/Users/PC/AppData/Local/Temp/allied-customers-care-20261025/`:
`before-customers-1440.png`, `after-customers-1440.png`,
`before-customer-detail.png`, `after-customer-detail.png`,
`before-care-1440.png`, `after-care-1440.png`, responsive `customers-*.png` and
`care-*.png`, `customer-care-create.png` and `managed-care.png`.
Hosted suite receipts are under `%TEMP%/allied-customers-care-hosted/`.

Browser UI mutations use intercepted fixtures; API integration checks use real
isolated PostgreSQL. No real customer was suspended, replied to, or had notices
dismissed for acceptance. Clipboard writes use instrumented success/rejection
callbacks; no operating-system clipboard was read. Touch and 200% zoom reflow
are emulated; physical devices, an actual on-screen keyboard, complete screen-reader
testing and authenticated operational real-role acceptance remain unverified.
These results do not certify every dashboard consumer or close site-completion Item 6.

## Production release — 25 October 2026, final frontend 19:44 UTC

Live on [www.alliedautotech.com](https://www.alliedautotech.com) and the apex domain:

- Frontend **`dpl_BVUgeibwBeTL3EvTZPiiCM9nMNgf`**, READY, both aliases verified.
- Backend **`9ed4a4f2-683a-41f2-ab43-39673783a4a5`**, ACTIVE, no pending rollout.
- All four images use source `dc0322f0`; the final frontend uses `fd19aabc`, whose
  backend runtime is identical. Later evidence commits do not change runtime code.
  Immutable API / identity / general / migrate
  manifest digests respectively:
  `c14b184fdafb9bf7199a765e27241488466b9dff6a24d00ae79ed23e3ff70008`,
  `c24e74af61245e0c381d82fc1855921b02e70a2266579a3d1b50579ea8fed813`,
  `d1d793db0020233090f1bd6f3a84c2a3c5dd18ece6ee4333bfce175bed5ffdbc`,
  `6f5260f3d060dac0dd8ea81d2110374d57b5ceaf82b8e69579014f7044cfa303`
  (all `sha256:`).

The guarded migration completed at 19:21 UTC after a fresh verified backup. Live
history/schema checks and all 71 checksums passed. Runtime remains non-owner with
no schema CREATE, TRUNCATE, superuser, role/database creation or bypass-RLS rights;
the new table has the existing reviewed DML defaults, and backup SELECT is verified.
No grants were changed. Separate migration and backup identities were used.
Temporary exact-IP access was removed and the original app-only firewall verified
after both migration and postcheck. Eight worker heartbeats and API readiness passed;
the unauthenticated directory returns 401. Predeploy remains a read-only database gate.

During release, the guard detected independently released compatibility source
`313c4f9c` (backend `634b9110-8ad0-455e-ad7d-48cd9ee35681`). It stopped before
overwriting that release. The fix was merged, contracts regenerated, four new
images built/checked/pushed and the merged candidate accepted before promotion.
The additive schema was unchanged, so no second production migration was needed.
The first local wrapper preflight also stopped on a receipt filename mismatch
before any SQL/firewall operation; the correct retained rehearsal receipt was used.

Post-promotion Edge smoke passed **12 read-only journeys** on main/www at 390/1440px:
home, parts, vehicles, customer-directory and support authentication redirects.
No unexpected console/runtime errors or page overflow; no production fixture,
account-status change, reply or dismissal was performed. Receipts/screenshots:
`%TEMP%/allied-customers-care-live/`. Authenticated real-role acceptance retains
the limitation above; anonymous redirects are not evidence for those workflows.

Rollback resources are retained: immediate predecessor backend `634b9110` uses
the compatibility API `bf2d62fe...` with notification workers/checker `345847d5`;
pre-care frontend `dpl_GDqL1pgfFbWtb7avvNGGW8Zu3bNH`. The initial care frontend
`dpl_JAEZULBoPpBYEhTSywcqCSVYVWig` is the immediate frontend rollback. The earlier notification backend
`1876e3d1` and frontend `dpl_37Wd7HsDbxGiqpaZw8qL1oZuDpG3`, plus the R2 recovery
resources, also remain. A rollback must retain migration 71 and a **71-aware
predeploy checker**: older 70-migration checkers correctly reject unknown history.
Review compatibility and revert the frontend before an API lacking these new
endpoints. Do not drop the acknowledgement table, edit history or restore over live.

Docker completion review removed only the owned, connection-free, auto-remove
tmpfs PostgreSQL fixture and eight local tags for four superseded, never-released
`bbb2633b` candidate images. Their remote images/receipts are retained. Docker totals
changed from 55 to 51 images (12.03 to 11.99 GB), 14 to 13 containers; all 14 volume
identities and warm caches/current/rollback/base/tool/other-task resources remain.
Host space decreased about 34.3 MiB during that measurement; logical Docker cleanup
is **not** a claim of physical host-space recovery. Postflight C: was 28.77 GiB free,
above the 20 GiB reserve at that point. No broad prune, duplicate install/worktree,
image archive, backup deletion or machine-wide space guarantee.
