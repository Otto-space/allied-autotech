# Promotions and invitations: contracts and verification

Reviewed19 October2026. Implemented locally for `/admin/staff/invite`; deployed verification remains open. The [frontend acceptance report](../../frontend/docs/page-quality/work-staff-invitations.md) records milestone90.

## Contract changes

The existing exact-email candidate endpoint now returns explicit `management.canPromote` and `management.canInvite` flags, plus safe named branch facts. Eligibility follows the existing promotion/invitation rules, including active verified accounts, required profiles, active branches and workforce delegation. Internal workforce rows and password hashes are excluded. The existing legacy/workforce routing boundary remains intact.

Candidate and invitation reads recheck the acting account/session under the existing access lock and record minimal atomic READ audits. Candidate, promotion, invitation, list, inspection and revocation controller responses explicitly use `Cache-Control: private, no-store`. Actual safe response DTOs are documented in OpenAPI and reflected in generated frontend types.

`GET /admin/staff/invitations/:invitationId` adds authorized inspection of one invitation. Admins can inspect only invitations they created; Super Admin retains existing all-invitation visibility. The endpoint rejects invalid UUIDs and unsupported queries, returns404 for an unavailable or out-of-scope record, and records a minimal `INVITATION_DETAIL` READ audit. It returns ID, email, role, recipient/inviter references, created/expiry/used/revoked timestamps and computed status. It never returns the invitation token or its hash.

Existing mutation payloads, password/MFA/CSRF checks, account/session locks, active-branch rules, invitation replacement, encrypted outbox creation, acceptance and revocation transactions are unchanged. Queued email does not establish delivery. No schema/migration or grant change was needed.

## Focused verification

- Two new API cases verify safe candidate eligibility, active branch facts, enrolled-admin legacy denial, private responses, invitation ownership, all four statuses, exact safe keys, READ audits and preserved existing rows.
- All12 existing `team-access.test.ts` cases pass: promotion and preserved customer history/credentials, session revocation, proof rejection, authenticated intended-recipient acceptance, MFA/CSRF, replacement/expiry/revocation, inviter/recipient changes, concurrent acceptance/revocation, suspension and role-tampering rejection.
- The focused delegated-invitation acceptance case in `workforce-access.test.ts` passes. It verifies permitted invitation creation, recipient identity, withdrawal/reinstatement of the owner delegation envelope and retained managed-access boundaries after acceptance. The other11 cases were deliberately not repeated for this route.
- Backend type checking, focused lint, OpenAPI export/validation and mounted-route coverage passed:305 documented paths,359 operations plus four infrastructure routes. No generated declarations were manually edited.

The API runs use the retained isolated database `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, created and migration-verified for the preceding staff milestone. Actual target/environment and restricted runtime identity were checked before writes. Its runtime has no database/table ownership, schema CREATE, TRUNCATE or elevated privileges, as verified at creation; current runs also checked superuser, database-creation and role-creation flags. No schema changes required another migration replay.

Initial inspection fixture setup encountered expiry and unused-recipient constraints. Those constraints were retained. The continuation reused the already-created synthetic administrator and pending invitation, then gave the expired fixture its own synthetic recipient with a valid creation/expiry interval. No completed application action or existing record was reset to recover the tests.

Before/after whole-row hashes for the12-case regression confirmed unchanged original12 users,0 customer profiles,11 staff profiles,4 invitations,0 outbox events,2 branches,1 capability grant,4 workforce-access rows and4 assignments. Its29 owned temporary sessions were removed. The separate delegated case preserved41 users,3 customer profiles,38 staff profiles,16 invitations,11 outbox events,31 branches,1 capability grant,4 access rows and4 assignments; its13 owned temporary sessions were removed. Synthetic domain fixtures were retained.

## Connected production evidence

Production Next.js, Edge, the real Express API and isolated PostgreSQL completed four domain mutations across two newly added synthetic customers: two promotions, one administrator invitation and one selected-invitation revocation. The invitation created exactly one outbox event and did not change the recipient's role before acceptance. Promotion preserved credentials/customer profiles, assigned the selected branch and revoked the existing customer session. Two ROLE_CHANGE audits, one INVITATION_CREATED audit and one revocation UPDATE audit were verified.

One promotion committed before its response was deliberately lost. Reload retained the local lock; fresh account inspection and explicit independent reconciliation unlocked the page. Exactly two promotion requests were sent for the two distinct customers, with no replay. No password was present in browser storage.

All original53 users,5 customer profiles,48 staff profiles,17 invitations,12 outbox events,33 branches,1 capability grant,14 workforce-access rows and16 assignments were hash-unchanged. Both newly created customer profiles also remained unchanged. All three owned temporary sessions were removed. No page errors occurred.

Private evidence is under `C:/Users/PC/.codex/work-staff-invitations-{api-tests,regression,delegation,real}*`. It contains synthetic test references; credentials and private outbox payloads are not included in this document.

## Remaining backend gap and rollout limits

ADM-55 remains an optional durable original-request receipt improvement. The browser stores only a random token, action and target reference, bound to the acting account/role. It locks an uncertain result across reload and requires current authorized inspection plus independent reconciliation. It does not prove the original outcome or provide cross-device idempotency. A future durable receipt must preserve password/MFA and current authorization, avoid raw password storage and follow the forward-migration safety workflow if persistence changes.

No application/shared database, existing grants, schema/migration files, backup/restore operation, off-device recovery verification, external delivery provider, push or deployment was changed or run for this milestone. Existing database-safety rollout requirements still apply before shared or production deployment.
