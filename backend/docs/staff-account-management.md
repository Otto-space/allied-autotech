# Staff account management — implementation evidence

Updated 19 October 2026. Staff account detail passed its [local frontend gate](../../frontend/docs/page-quality/work-staff-detail.md), milestone89. Deployment and application-wide acceptance remain open.

## Account revision condition

Status, branch and role mutation bodies now accept optional `expectedRevision`. New frontend requests always send it. It joins the returned account `updatedAt`, role, status, profile `updatedAt` and branch ID with colons, matching the existing client revision function. After the existing organization/actor lock, the server locks the target User and StaffProfile rows and checks the revision before mutating. A changed revision returns the existing conflict response. Authorization still takes precedence: an already-demoted Staff account is forbidden as a demotion target.

The condition is optional to preserve existing clients; only requests supplying it gain this stale-record protection. Existing self/Super Admin restrictions, Admin-versus-Staff scope, active branch validation, supported demotion, no-op rules, session/invitation revocation and atomic mutation audits remain in place. Account reads and successful mutation receipts explicitly use private/no-store responses. OpenAPI now describes their actual safe DTOs. No schema migration is needed.

## Capability reads and changes

Super Admin capability reads now use an explicit safe projection, stable granted-time/ID ordering, private/no-store responses and a minimal successful READ audit in the same transaction. The audit includes resource, selected account, active-only flag and returned count; it does not copy grant contents. The existing all-active/latest-100-history behavior is preserved.

Capability reads, grants and revocations recheck the actor under the existing organization/actor lock. Grants also lock the target account before checking active verified privileged eligibility. Existing grants are retained; granting an already-active duty returns that grant. Revocation still returns its supported id/revoked receipt. Grant/revoke receipts use private/no-store responses and their actual DTOs are documented. No role or grant expansion is introduced.

## Frontend recovery

One coordinator now covers account, capability and workforce panels on staff account detail. It rechecks the actor and target revision before submission, marks a minimal actor/role/target-bound pending entry before the request, clears it only after a validated success or explicit rejection, and retains it for uncertain results. Storage contains only a random token and action area, with no passwords, reasons, contact data or body fingerprints. Session invalidation redacts it. Unavailable recovery storage prevents submission.

Pending state survives reload and locks all three panels. Fresh authorized inspection and an explicit independent reconciliation acknowledgement are required before local unlock. Current facts do not prove that a particular original request completed. This is a device-session safeguard, not durable server idempotency or a cross-device receipt.

Account, capability and workforce receipts are validated. Workforce access receipts check the target, actor, version, preserved enrollment timestamp, position and exact delegation sets; assignment/revocation receipts check target, scope, immutable facts and intended change. Passwords clear and re-hide before review. Branch discovery uses the paginated administrator picker for owners and the exact active permitted set for delegated administrators. Shared owner and delegated lookup flows have browser and connected evidence.

Standalone responsibility management uses its scoped workforce inspection endpoint for target preflight and reconciliation. It never fabricates a legacy staff record or widens the workforce boundary to permit legacy staff/branch reads. The detail page retains its account revision preflight.

## Workforce inspection

The existing inspection response adds `accountLabel`, safe branch references (`id`, `name`, `code`, `isActive`) and `management` flags/template/branch scope. These reflect current self/protected-target, profile, active/verified account, enrollment and delegation rules. Inactive references remain visible where needed to explain existing records. Delegated administrators see only assignments and branches within their approved envelope. The server remains authoritative for every mutation.

Workforce account reads and receipts explicitly use private/no-store responses. The existing `UPDATE` / `ACCESS_PREVIEW` inspection audit is retained; it is not represented as a new READ audit. Existing password, MFA, target, version, branch and delegation checks remain intact. No schema migration or permission expansion is needed.

## Verification and preservation

The actual isolated target was verified as127.0.0.1:55480 / allied_work_aftercare_20261017_test before writes, using restricted non-superuser credentials. Three synthetic accounts were added and retained. Existing users, profiles, capability grants and branches were hash-checked and unchanged. Tests verified status/branch revision rejection, target-session revocation, one winner for concurrent status/branch changes, supported owner demotion, and private audited capability reads/grant/revoke.

Two initial API cases passed. The third successfully exercised concurrency and demotion, then stopped because its replay assertion expected409 instead of the existing403 authorization response. The expectation was corrected; a separate continuation verified the remaining forbidden-demotion and invalid-promotion assertions without replaying completed account mutations. That continuation hash-checked all account/profile/grant/branch rows, including the new fixtures. Owned temporary sessions were removed.

The workforce API setup first encountered the existing single-owner constraint before creating any fixtures in the aftercare database. It then used a newly created isolated target:127.0.0.1:55480 / allied_work_staff_workforce_20261019_test. Empty migration replay and `db:check` passed. A new restricted runtime role was verified without ownership, schema creation, TRUNCATE or elevated role privileges. No existing role grants were changed. Five synthetic API accounts and two branches were added and retained; three API cases passed, including exact receipts, private inspection, protected/inactive/missing-profile actions, incorrect password/missing CSRF, stale versions and delegated template/branch boundaries.

Connected production Edge/API/PostgreSQL added five more synthetic accounts and completed11 domain changes, including a committed assignment whose response was lost. Reconciliation completed without replay. The initial final-count assertion included CSRF issuance, so a separate read-only continuation verified persisted state, six workforce mutation audits and real delegated lookup without legacy API calls. That continuation hash-checked all10 users,9 profiles,1 grant,4 workforce-access rows,4 assignments and2 branches. No original-account mutation audits were present. The original connected run did not reach its final whole-row hash check; preservation by whole-row comparison is claimed only for the continuation. Both runs removed all owned temporary sessions. Successful changes were retained and never repeated to obtain a green test run.

All48 production browser scenarios have passing evidence. After one transient contrast failure, the scoped CSS fix and rebuilt production bundle passed all nine affected responsive/Axe cases. Four workforce units and two existing recovery-storage units pass. Frontend/backend types, focused lint/formatting, OpenAPI export/generated types and route coverage passed:304 paths,358 documented operations plus four infrastructure routes. Production build, native visual comparisons and14 matching runtime/generated source hashes pass.

No application/shared database, schema/migration files, existing grants, backup/restore, external provider or deployment operation changed. The new empty workforce database replay and read-only safety check supplement earlier migration evidence; they do not establish off-device backups or restore recoverability. Private evidence files use `work-staff-account-api-`, `work-staff-workforce-`, `work-staff-detail-real` and `work-staff-detail-final-` prefixes under `C:/Users/PC/.codex/`.
