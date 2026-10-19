# Staff account detail — audit in progress

Route `/admin/staff/[staffUserId]`, next milestone89 after accepted directory88. Audited18 October2026. This document is not acceptance.

Baseline production captures at430/768/1280/1440 for Admin, plus430/1440 for Super Admin, recorded no overflow or page errors. Native four-width Admin inspection shows an oversized facts block, raw reference dominating the hierarchy, widely separated labels/values and action fields below the first viewport. Super Admin adds two long independently managed panels. Existing shell, forms, branch picker and review dialog are reusable.

## Endpoint and permission inventory

| Endpoint                                   | Existing rules and result                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /staff/profile                         | Own identity, role, status and capability facts; use to confirm the current actor before private reads.                                                                                                                                                 |
| GET /admin/staff/{id}                      | Active MFA-verified Admin/Super Admin; safe identity/profile/branch projection; successful STAFF_PROFILE READ audit in the transaction. Strict empty query/UUID.                                                                                        |
| PATCH /admin/staff/{id}/status             | CSRF; not self or Super Admin target. Admin manages Staff only, owner also Admin. Status enum, no-op conflict; locks actor/target, revokes sessions/invitations, atomic audit; returns id/status.                                                       |
| PATCH /admin/staff/{id}/branch             | Same management boundary; Staff target with profile, different active branch; revokes sessions/invitations; returns profile id/branchId.                                                                                                                |
| PATCH /admin/staff/{id}/role               | Super Admin only; existing supported demotion to Staff with active branch. No direct promotion bypass. Returns full staff record.                                                                                                                       |
| GET /admin/branches                        | Existing private cursor-based branch picker. Active-only for assignments; preserve inactive facts when inspecting current identity.                                                                                                                     |
| GET /admin/capabilities                    | Super Admin only, selected user, all active grants or latest100 history; currently no explicit no-store/read audit.                                                                                                                                     |
| POST /admin/capabilities                   | Super Admin+MFA+CSRF; target active verified privileged account, seven known duties. Advisory lock, returns existing active grant or new grant with atomic audit. Self and Super Admin targets are supported.                                           |
| POST /admin/capabilities/{id}/revoke       | Super Admin+CSRF; reason10–1000, returns id/revoked. Repeated revoke currently adds an audit; no original-request receipt.                                                                                                                              |
| GET /admin/workforce/accounts/{id}         | Owner may inspect privileged accounts; delegated Admin only Staff in the permitted current branch. Returns access version, assignments, server-selected active IDs and templates. Successful inspection currently records UPDATE/ACCESS_PREVIEW.        |
| PUT /admin/workforce/accounts/{id}         | Owner enrollment/position; password, reason, expectedVersion. Excludes self/Super Admin/missing profile/inactive/unverified targets. Enrollment preserves financial grants and replaces legacy operational access; initial enrollment revokes sessions. |
| POST .../assignments                       | Owner or delegated Admin within template/branch envelope; password, reason, version; enrolled active verified target, active branch, valid dates; atomic assignment/version/audit.                                                                      |
| POST .../assignments/{assignmentId}/revoke | Same target/operator restrictions and version; assignment belongs to target and must be unrevoked. Revocation remains possible on inactive target.                                                                                                      |
| PUT .../delegation                         | Owner only, enrolled Admin target, password/reason/version, up to8 templates/20 active branch IDs, optional admin invitation authority. Grants no operational powers by itself.                                                                         |

## Required corrections

- Confirm live actor identity and clear private sections on denied reads. Coordinate pending actions across account, workforce and capability forms.
- Preserve unknown mutation outcomes across reload with minimal actor/target-bound metadata, no passwords/reasons stored, no automatic replay. Current reads alone do not establish original-request completion.
- Workforce panel currently exposes impossible enrollment/assignment controls on protected targets, exposes Admin delegation for Staff targets and uses only the first50 public branches. Match actual eligibility and supported delegated Admin scope.
- Validate workforce mutation receipts, separate failed preflight from uncertain submission, retain server version protection, show complete review facts and field validation.
- Passwords need the existing visibility treatment and must clear/re-hide after sensitive transitions.
- Capability reads need explicit privacy/audit handling; account preflight is not atomic server compare-and-swap. Document remaining original-request receipt limitations accurately.
- Replace raw primary IDs with secondary reference disclosure; update breadcrumb from the returned name. Keep null-profile and long-content fallbacks.

No application/shared database writes, schema changes or grant changes occurred during this audit. Existing account fixtures and completed directory checks are reused only as baseline evidence.
