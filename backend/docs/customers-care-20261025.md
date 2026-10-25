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

Runtime backend/image source: `bbb2633b588bba562bad665fbd9642f51d621439`.
Frontend runtime source: `7795bb66e1db3cc1e94a04fdca16b40b3fadda5f`.
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

## Verification evidence before promotion

- [Frontend locked release CI](https://github.com/Otto-space/allied-autotech/actions/runs/40223805013):
  1,024 tests / 155 files, lint, types, formatting, production build (Next 16.4.3)
  and production dependency audit passed; production audit found zero vulnerabilities.
  The install reports development dependency findings; zero is not a whole-tree claim.
- [Backend database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40221688018):
  full 71-migration replay, `db:check`, types/scripts/lint, 60 database safety units,
  the real missing-column guard case, seven public-enquiry checks, 58 catalogue/
  vehicle checks and 46 customer/auth/care integration checks passed.
- Local exact-loopback restricted-runtime customer/auth/care integration rerun:
  **46 passed / five files**. These use real isolated PostgreSQL and HTTP requests,
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
- Protected compiled candidate `dpl_CZSje9b6GVx8SdQAxmCQgEP67TNd`:
  **15/15** new Edge browser scenarios passed. Real rendered table/copy/menu,
  directory return state, Admin/Super Admin review, delivery failure/history/reload,
  separate creation drafts, scoped managed CS and responsive states were exercised
  with isolated HTTP fixtures. Normal scenarios had no console/runtime errors;
  scoped Axe checks and measured badge contrast passed. Main/www were not promoted
  by creating the candidate. Each temporary review key was revoked afterward.

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

Production migration and promotion remain pending until final conversation regression
checks and live release gates finish. The release receipt below will record outcomes.
