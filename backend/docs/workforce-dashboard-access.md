# Workforce dashboard and access integration

Implemented on `feat/workforce-dashboard-access`, using
`Allied_AutoTech_Dashboard_Access_Codex_Prompt.md` as a proposed implementation brief.
Its workforce facts are distinct from approval of financial authority. No live
accounts, assignments, invitations, launch policies or staffing capacity were changed.

## Inspected implementation and decisions

- `src/common/middleware/authenticate.ts`: opaque database sessions, current account
  role/status on every request, idle expiry, and MFA. This remains the identity system.
- `src/modules/organization/{organization,team-access}.*`: branch/staff profiles,
  verified-account staff provisioning, password/MFA checks, invitation acceptance,
  session revocation and the existing organization access lock.
- `src/modules/policies/policies.service.ts`: explicit `UserCapability` grants for
  sensitive existing functions. These records are preserved, not copied into templates.
- `src/modules/service-operations/*`: bookings, assigned staff, versioned work orders
  and an existing `QUALITY_CHECK` state. No job-evidence upload/checklist model exists.
- `src/modules/{support,orders,payments,overview}/*`: existing enquiries/complaints,
  record ownership, collection preparation, verified payment flows and broad legacy
  staff/admin views. Existing support ownership supports explicit sales-task transfer.
- `src/modules/identity/identity.service.ts` and `frontend/app/components/dashboard-shell.tsx`:
  session revalidation, shared navigation, account security and customer experience.
- `frontend/lib/api/{client,use-resource}.ts`: CSRF, safe errors, no-store requests,
  cancellation, sign-out invalidation and visibility revalidation.
- `docs/owner-decision-checklist.md` and existing policy services: preserve approved
  gates. This change does not resolve unapproved financial or seller decisions.

Legacy role checks are broad. Replacing them for every existing account would remove
unreviewed access. Therefore the verified owner must explicitly enroll each account.
Enrollment is a reviewed cutover: broad legacy operational APIs become inaccessible,
existing sessions are revoked, and operational access starts with no assignments.
There is no automatic enrollment, title-to-ADMIN mapping, or unenrollment shortcut.
Document the person's approved legacy duties before that cutover.

## Implemented behavior

`WorkforceAccess` holds reviewed enrollment, job position and an owner's delegation
envelope. `WorkforceAssignment` holds independent responsibility sources with branch,
server-selected scope, primary/temporary designation, start, optional expiry, reason,
assigning actor and revocation history. Department derives from position metadata.
Templates are immutable application definitions; there is no template-edit API.

`workforce.policy.ts` resolves active assignments centrally. Unknown templates,
invalid scopes, inactive branches, future starts, expiry and revocation never grant
access. Permissions combine without widening one assignment's branch/record scope
using another assignment. Each operational request rechecks the account, session,
assignment, resource and workflow state inside a transaction. Version checks and the
existing access lock serialize responsibility changes, work approval and reassignment.

Enrolled accounts, including ADMIN, are denied access to broad legacy protected APIs
by authentication middleware. Only authenticated account-security routes, their own
staff profile and the explicitly protected workforce routes remain available. Thus
legacy list/detail/export/download/notification paths cannot bypass new projections.
Accounts awaiting enrollment retain their existing approved role behavior; this is
an explicit migration boundary, not a claim that all legacy authorization was replaced.

The existing dashboard shell composes navigation, search, home counters and pages
from backend permissions. Initial access loading and failed access checks do not mount
protected pages. Access revalidates on visibility/online, every 30 seconds, and at the
nearest known expiry. Changed versions/sources discard mounted workspace data. Routine
revalidation preserves in-progress forms when access is unchanged. Sign-out uses the
existing cache invalidation. Backend denial applies on the next protected request,
independently of browser polling; there is no new push-notification mechanism.

Successful reads/changes use existing audit records. Assignment records retain actor,
reason and dates. Denials use existing safe HTTP error/log behavior; this change does
not introduce a durable audit entry for every denied request or tamper-proof storage.

## Responsibility, action and scope matrix

| Responsibility | Permitted baseline | Scope and restrictions |
| --- | --- | --- |
| CEO/MD | Existing verified-owner dashboard and approved owner actions | Ownership/bootstrap unchanged; title grants nothing |
| Operations Supervisor | Booking queue; operational order progress; paid collection preparation to PROCESSING/READY | Explicit assignment branches; no technician assignment, quality approval, release or finance |
| Customer Service Officer | Booking queue, enquiries/replies, complaints/replies, order progress | Explicit branches; booking contact projection only; no exports/finance |
| Sales Supervisor | Product/vehicle enquiries, replies, explicit task allocation, order progress | Explicit branches; no price publication, seller powers or refunds |
| Sales Representative/Cashier | Assigned product/vehicle enquiries and replies | Assigned records in explicitly granted branches; orders have no existing cashier-ownership field, so broad order access is withheld |
| Accountant | Payment records tied to authorized branch bookings/orders/invoices | Minimal payment projection; no provider credentials, reconciliation mutation, exports or refund powers |
| Workshop/Quality Service Lead | Job queue/detail, eligible-technician selection, assignment, technical notes/progress and independent quality approval | Explicit branches; cannot approve work performed by or currently assigned to self |
| Electrical/Diagnostics Technician | Assigned job details, vehicle, symptoms, diagnosis, work/parts notes and progress to QUALITY_CHECK | Current assignment and granted branch; no customer contact projection, finance or assignment authority |
| Mechanical Technician | Same mechanical template for two distinct accounts/jobs | Same restrictions; no staffing-capacity inference |
| CUSTOMER | Existing own-record customer dashboard/actions | Existing customer ownership checks unchanged |

`QUALITY_CHECK` means ready for review. Only an independent authorized reviewer can
complete the work order and booking. All technical contributors are recorded, so
combining templates or reassignment cannot erase a contributor's self-review block.
Legacy work-order writes also preserve contributor IDs for a subsequent reviewed
account cutover, without adding those internal fields to existing customer DTOs.
Legacy work with unknown contributors is blocked from this approval path. Completion
does not mark payment successful or release a collection. Existing reminder
cancellation is reused on completion.

## Operator workflow

1. The verified owner opens **Team & Access → Staff directory → staff account** or
   **Responsibilities**, selects the verified account and reviews existing duties.
2. Review enrollment with position, reason and current password. Position alone grants
   nothing. Enrollment revokes sessions; the person signs in again with existing MFA.
3. Assign primary Operations to the verified Operations account. Separately assign
   Sales Supervisor and Customer Service Officer as temporary cover, reason “position
   vacant”. Enter actual start times. Leave expiry empty when no end date is approved.
4. For a new hire, use existing verified-account provisioning/invitation, enroll the
   verified account, and explicitly assign its responsibility. Where appropriate,
   transfer outstanding sales enquiries through the scoped assignee selector.
5. Independently revoke the relevant temporary cover. Review remaining assignment
   sources; shared permissions remain while another valid assignment grants them.

Only the owner can enroll accounts or configure delegation. An enrolled ADMIN may
grant/revoke only allowed templates in allowed branches, only for other STAFF accounts.
Self changes and changes to ADMIN/SUPER_ADMIN are denied. MFA, current password and
expected access version are required. No responsibility itself grants access management.

The optional owner delegation flag `ADMIN_INVITE` preserves the existing secure admin
invitation flow for enrolled admins. Recipients must be verified enrolled staff in a
permitted branch. Delegation is checked again at acceptance. Acceptance preserves
enrollment and does not add operational, financial or delegation permissions. Legacy
approved admin invitations remain available through their existing routes. No invitation
or email was sent to a real account during implementation/testing.

## Routes and contracts

- `GET /auth/session` adds `workforceManaged`; existing fields remain.
- `GET /staff/workforce/access` returns authoritative sources, scopes, actions and
  delegation availability. `/overview` returns only permitted counters.
- `GET /staff/workforce/{jobs,bookings,enquiries,complaints,orders,finance}` returns
  scoped projections with bounded keyset pagination. Unknown filters are rejected.
- Job detail, work updates, assignment, independent quality approval and scoped
  assignee choices live under `/staff/workforce/jobs/{id}`.
- Enquiry replies, explicit sales-task reassignment and scoped assignee choices live
  under `/staff/workforce/enquiries/{id}`. Complaints support scoped replies.
- `PATCH /staff/workforce/orders/{id}` permits only paid collection preparation to
  PROCESSING/READY through valid preceding states; no payment or release fields.
- `/admin/workforce/accounts/{userId}` supports preview and owner enrollment/position
  updates. `/assignments`, `/assignments/{assignmentId}/revoke`, and `/delegation`
  support independently reviewed access changes.
- `POST /admin/workforce/invitations` wraps the existing invitation service.
- UI uses existing `/admin` shell and `/admin/workforce/[[...section]]` pages.

Request/response contracts are registered in `workforce.schemas.ts` and
`workforce.openapi.ts`; generated OpenAPI, endpoint handbook and frontend API types
must accompany future changes. CSRF and existing rate limits protect mutations.

## Migration and recovery

`20261018140000_workforce_access` only adds two tables, indexes/foreign keys and
work-order contributor/quality fields. It does not update accounts, assign permissions,
backfill workforce facts, or alter existing financial/business rows. The schema and
forward migration are kept together. The Prisma client was regenerated.
Schema/migration commit: `c569df8`. Application/UI changes remain in the working tree
so the pre-existing workspace edits are not bundled into that database commit.

An empty replay of all 60 migrations and read-only `db:check` passed against newly
created `localhost:5432/allied_workforce_20261018_8f71_test`, environment `test`.
Application database `localhost:5432/allied_autotech` was not migrated or modified.
No backup creation, restore rehearsal, off-device backup, retention or PITR check was
performed: this was source implementation and isolated testing, not a shared rollout.

Before rollout, review the account cutover and migration, verify required encrypted
off-device backups/recovery and restore rehearsal, then use `npm run db:migrate` and
`npm run db:check` on the confirmed target. Do not bypass backup/history/drift gates.
There is no down migration or automatic data deletion. After enrollment, do not roll
back to code that ignores workforce restrictions: retain compatible code and fix
forward. Revoke incorrect assignments through the reviewed API while preserving history.

## Verification and safe fixtures

`tests/fixtures/workforce.ts` refuses non-test targets and creates synthetic accounts
for every relevant template, two mechanical technicians, independent jobs, Operations
with both covers, scoped admin, shared protected owner and separate customers. No live
seed command or default production passwords are provided. Email/provider modes are
disabled by the existing test setup.

Use a **new**, isolated database ending `_test`/`_ci`, confirm its actual host/port/name,
and follow `docs/database-safety.md`. Set `NODE_ENV=test`, `DEPLOYMENT_ENV=local`,
`DB_NAME` and `TEST_DB_NAME` to that isolated name, then use the existing test-database
creation and empty migration-replay scripts. Enable `RUN_DATABASE_TESTS=true` only
there. Never repoint these tests at the application database.

Relevant checks: backend authenticated integration tests for workforce, team access,
capability profile and overview; backend unit suite and OpenAPI handover checks;
frontend unit suite; Playwright workforce/navigation tests; type, lint, build,
OpenAPI/route consistency and targeted formatting checks. Browser tests use synthetic
HTTP fixtures; backend tests separately exercise real session, CSRF, MFA, database
scope and mutation enforcement. Browser plugin was unavailable; repository Playwright
with Edge was used on localhost, including desktop/mobile, accessibility and screenshots.

Recorded results:

| Check | Result |
| --- | --- |
| Frontend unit suite | 91 files, 706 tests passed |
| Backend unit suite / corrected contract rerun | 39 files passed; OpenAPI handover file subsequently passed all 6 tests (40 files / 314 tests covered) |
| Authenticated integration regression group | Workforce, team access, capability profile and overview: 30 tests passed before the additional workforce cases |
| Final workforce integration suite | 12 tests passed, none skipped, including owner enrollment, delegation, concurrent grants and legacy contributor preservation |
| Existing service workflow regression | `phase5-flow.test.ts` passed after contributor-history integration |
| Browser regression group | 28 workforce/navigation checks passed; final workforce rerun passed all 5 after form-preservation and scoped-selector changes |
| Browser environment | `http://localhost:3010`, Edge; new surfaces at 1440×1000 and 390×844; existing navigation at 320–1655px |
| Browser evidence | New Operations flow had no page errors; screenshots inspected; desktop/mobile accessibility assertions passed |
| Frontend/backend production builds | Both passed, including frontend standalone preparation |
| Type and lint checks | Frontend and backend passed |
| API contracts | 353 mounted/documented operations matched; OpenAPI validation passed for 299 paths; frontend types regenerated |
| Formatting / secrets | Changed-source formatting passed; existing secret guard passed for 2,341 non-ignored files |
| Database safety | Empty 60-migration replay, schema diff, regenerated client and isolated read-only `db:check` passed |

The stale API handover assertions were updated for explicit admin document access
and an expandable operation inventory. Exact completeness remains enforced by the
mounted-route coverage check. Screenshots are in the local temporary directory as
`allied-workforce-desktop.png` and `allied-workforce-mobile.png`. Development tooling
emitted Console Ninja connection warnings and a transient Next router warning during
legacy navigation tests; the new Operations flow's captured page-error check passed.

The owner-positive integration case needs the synthetic owner credential created by
the workforce fixture. If another fixture already created the sole synthetic owner
with an unusable/different password, that case skips rather than rewriting the owner.
It ran and passed on the isolated database recorded above.

## Explicit limits and unresolved policy

- **Policy-blocked:** refund/discount/void approval limits, price/stock publication,
  settlement/configuration, financial exports and collection-release exceptions are
  not bundled into new templates. Existing owner-approved paths are preserved.
- **Unsupported in these scoped pages:** booking creation/rescheduling/capacity
  changes, complaint SLA/status administration, quote drafting, technical checklist or
  evidence uploads, reconciliation writes, cash/till entry, broad accounting, payroll,
  seller onboarding and recruitment. Existing modules are not relabeled as implemented
  scoped workflows. Add each only with reviewed field/scope/state enforcement.
- **Preserved launch boundaries:** no changes to public customer registration,
  checkout/provider verification, configured booking capacity, collection address,
  deferred delivery or paid vehicle reservations. No hours or staffing totals inferred.
- **Not tested here:** production migration/backup/restore, provider settlement or
  live email delivery, live account cutover, production concurrency/load, and other
  browser engines. Successful isolated checks do not establish zero rollout risk.
