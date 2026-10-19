# Staff account detail — local acceptance

Accepted locally on 19 October 2026, milestone 89. Route: `/admin/staff/[staffUserId]`. Next separate page: promotions and invitations `/admin/staff/invite`. Application-wide and deployed acceptance remain open.

## Result

The page presents a named breadcrumb, compact identity and account facts, supported account changes, explicit responsibility management and operational permissions. Job title remains distinct from account role. Current actor identity, target identity, freshness and eligibility govern the controls. Account status, branch reassignment and owner demotion retain their existing authorization and session/invitation rules.

Account changes submit an atomic revision condition. Capability reads are private and minimally audited. Workforce inspection returns named branch references and permitted management actions. Enrollment, position, assignment, revocation and delegation validate their returned receipts. Paginated branch discovery preserves off-page selections; delegated administrators receive only their permitted active branches and templates. Passwords are hidden by default, can be revealed deliberately, and clear/re-hide before review. Invalid dates and reversed intervals cannot submit.

One coordinator prevents simultaneous changes and persists minimal recovery metadata across reload. An uncertain result locks all account-access panels until fresh authorized inspection and independent reconciliation. Passwords and request bodies are not stored. The shared responsibility lookup uses the scoped workforce endpoint, preserving the boundary that prevents enrolled administrators from accessing legacy staff/branch APIs.

## Design and fidelity

Four Admin baseline widths and two Super Admin baseline widths preceded fresh built-in ImageGen [desktop](work-staff-detail-oct-concepts/desktop.png) and [mobile](work-staff-detail-oct-concepts/mobile.png) concepts. Native review, the [audit](work-staff-detail-oct-concepts/audit.md), [specification](work-staff-detail-oct-concepts/spec.md), [prompts](work-staff-detail-oct-concepts/prompts.md) and [corrections](work-staff-detail-oct-concepts/corrections.md) preceded implementation.

| Comparison              | Rendered result                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and identity      | Existing Allied navigation, Quicksand and real role/status/branch facts replace generated branding, avatars and fabricated grants. The named breadcrumb has one semantic current-page entry.   |
| Desktop hierarchy       | Identity spans the content width; account facts and management sit side by side at 1280/1440. At 1440 the content starts at x292 and spans1112px.                                              |
| Mobile hierarchy        | At430,16px outer margins contain the identity, paired account facts and stacked management fields. At768 the facts remain paired while management moves below.                                 |
| Typography and controls | Heading30px desktop/24px mobile;14px body;48px fields and44px minimum buttons. Long timestamps preserve Lagos time and wrap. Enabled/disabled colors switch together to maintain contrast.     |
| Secondary facts         | Account references and responsibility details use disclosures. Missing phone/profile, inactive branches, unknown outcomes and empty permissions remain explicit.                               |
| Responsibility actions  | Ruled, collapsible sections keep enrollment, assignment and delegation separate. Dates, branch names, cover type and reasons appear in review; password text does not.                         |
| Honest permissions      | No inferred legacy assignments, invented counts or “Granted by You.” Protected accounts have no forbidden identity/workforce controls. Existing eligible capability controls remain available. |

Final native captures were reviewed at430/768/1280/1440 and Super Admin430/1440, including expanded mobile responsibility controls. All six captures had no horizontal overflow or page errors.

## Verification

- All48 production browser scenarios have passing evidence:15 detail cases,10 workforce cases and23 existing staff-access regressions. The first run passed47; the remaining768px Axe case identified a transient button-color mismatch. After the scoped CSS correction and rebuilt production bundle, all nine affected responsive/accessibility cases passed. These overlapping runs are not additional distinct scenarios.
- Responsive checks cover320/375/430/768/1280/1440/1920. Expanded workforce forms at430/1440 and unknown-permission recovery also pass Axe WCAG2A/AA,2.1AA and2.2AA checks. Browser coverage includes actor changes, stale/denied reads, storage failure, malformed receipts, lost responses, password clearing, dates, branch pagination, protected actions, and owner/delegated responsibility lookups.
- Four workforce contract/date units pass; the two existing recovery-storage units remain valid. Frontend/backend type checks and focused lint/formatting pass. OpenAPI validates304 paths and358 mounted operations plus four infrastructure routes; generated frontend types include the new workforce inspection contract.
- Production build and standalone preparation pass. Fourteen runtime/generated source hashes match the final build snapshot. No functional code changed after connected testing; the final change only removes account-button color interpolation.
- Account API evidence covers revision conflicts, session revocation, concurrent one-winner behavior, demotion and capability audit/receipts. Two initial cases passed; a focused continuation verified remaining rejections after the third case's completed mutations. Three new workforce API cases pass, covering protected/inactive/missing-profile eligibility, password/CSRF rejection, enrollment, assignment, revocation, stale versions and delegated scope. See [backend evidence](../../../backend/docs/staff-account-management.md) for exact limits.

## Connected workflow and data safety

Production Edge, the actual Express API and isolated PostgreSQL verified11 domain changes across five newly added synthetic accounts: status/session revocation, branch reassignment, owner demotion, capability grant/removal, two enrollments, two assignments, assignment revocation and delegation. One assignment committed before its response was deliberately lost. Reload kept the controls locked, current inspection preceded explicit reconciliation, and no duplicate assignment was sent.

The initial connected run finished reconciliation, then its final request-count assertion incorrectly included CSRF issuance. No successful domain actions were replayed. A read-only continuation checked persisted state, exactly two assignment records (one revoked, one active), the six workforce mutation audits, and a real delegated-admin lookup with zero legacy staff/branch requests and zero UI writes. All continuation rows were hash-unchanged:10 users,9 profiles,1 capability grant,4 workforce-access rows,4 assignments and2 branches. No original-account mutation audits were present. This whole-row preservation claim is limited to the continuation; the original run's final hash assertion was not reached. All owned temporary sessions were removed.

The workforce tests used a newly created isolated database, verified as `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`. Empty migration replay and `db:check` passed. Its new runtime role was verified without ownership, schema creation, TRUNCATE, superuser, role creation, database creation, replication or RLS-bypass rights. Earlier account checks used the retained isolated aftercare database and preserved its existing rows. No application/shared database, existing grants, schema or migration files were changed. No backup/restore rehearsal, off-device recovery verification, external delivery, push or deployment ran.

## Remaining limits

Recovery is a local device-session safeguard, not a durable original-request receipt or cross-device idempotency. ADM-55 records that optional backend improvement. Earlier clients omitting `expectedRevision` retain legacy behavior. Deployment, environment-wide role regression, invitations, branches, audit logs, processing jobs and remaining policies have separate gates.

Private evidence under `C:/Users/PC/.codex/`: `work-staff-detail-build`, `work-staff-detail-final-*`, `work-staff-detail-source-hashes.json`, `work-staff-detail-real*`, `work-staff-workforce-api-*`, `work-staff-workforce-migrations.log`, `work-staff-workforce-dbcheck.log` and prior `work-staff-account-api-*`.
