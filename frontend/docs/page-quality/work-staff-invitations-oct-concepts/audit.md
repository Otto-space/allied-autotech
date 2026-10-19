# Promotions and invitations — route audit

Route `/admin/staff/invite`, audited19 October2026 after accepted milestone89. This is milestone90 in progress.

## Existing presentation

The page uses the Allied dashboard shell and Quicksand, but its heading says Team & access rather than the route's Promotions & invitations. Search occupies an oversized single-field panel. List filters span the entire page, each invitation is a large card, and every revocable row exposes a password form. Candidate names are omitted while raw UUIDs lead the selected-account summary. Created, accepted and revoked dates are absent. Passwords have no visibility controls. The shell breadcrumb uses text separators rather than the required semantic ordered trail.

Baseline Edge screenshots at430/768/1280/1440 have no overflow or page errors. Native viewport inspection confirms excessive vertical space and repeated visible revocation proof fields. Evidence: `C:/Users/PC/.codex/work-staff-invitations-baseline-*`.

## Actual endpoints and authorization

| Endpoint                                             | Supported contract and scope                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/staff/profile`                                 | Current privileged identity/role/status and capabilities; required before private page reads and again before changes.                                                                                                                                                                                                            |
| GET `/admin/staff/candidates?email=`                 | Exact normalized email, one active verified Customer/Staff result. Names from customer/staff profile, staff branch ID. Existing minimal READ audit. Current DTO lacks explicit promotion/invitation eligibility.                                                                                                                  |
| POST `/admin/staff/promotions`                       | `{customerUserId,branchId,currentPassword}`. Admin/Super Admin with MFA and current password; target must be active verified Customer with profile and branch active. Creates/updates Staff profile, preserves customer profile/credentials, revokes sessions/invitations and records ROLE_CHANGE. Returns safe Staff DTO.        |
| POST `/admin/staff/invitations`                      | `{email,role:"ADMIN",currentPassword}`. Existing active verified Staff in an active branch; not self. Earlier unused invitations revoked; token hashed and encrypted email-outbox event created atomically.202 `{invitation,delivery:"QUEUED"}` never proves delivery. Existing workforce delegation checks remain authoritative. |
| GET `/admin/staff/invitations`                       | Limit1–100(default25), UUID cursor, optional PENDING/ACCEPTED/REVOKED/EXPIRED. Admin sees own records; owner sees all. UUID ascending and minimal READ audit. Safe ID/email/role/recipient/inviter/timestamps plus computed status; token never exposed.                                                                          |
| POST `/admin/staff/invitations/:invitationId/revoke` | `{currentPassword}`. Own invitation or owner, unused and not revoked, including expired. Returns full safe revoked record; no role change. Existing organization actor lock serializes changes.                                                                                                                                   |
| GET `/admin/branches`                                | Paginated active branch selection, reused picker.                                                                                                                                                                                                                                                                                 |

The generic page is for legacy Admin and Super Admin. Enrolled non-owner administrators are routed through the existing workforce workspace and cannot access legacy staff APIs. Do not widen that boundary. Acceptance of invitations is a separate route and must remain working if a shared contract changes.

## Required corrections

- Compact search and selected-account facts, paired fields, concise access guidance and ruled invitation rows with secondary detail/revocation disclosure.
- Semantic breadcrumb, current identity gate, strict target/scoped response parsing, explicit freshness/denial handling and URL-preserved list status/cursor history. Exact email search stays local and out of URLs.
- Independent password visibility, clear/re-hide proof before review, recipient/branch/role/date facts in confirmation, no password in storage or feedback.
- Existing uncertain state is only component memory. Add persistent actor-bound local recovery and fresh authorized inspection plus independent reconciliation. Never silently resend a promotion or invitation after a lost response.
- Backend: document actual safe responses; explicit private/no-store reads/receipts; recheck actor under lock for audited reads; return candidate eligibility based on existing mutation rules; provide scoped single-record invitation inspection for reliable selected-record preflight. No schema/migration, role expansion or email delivery is required.
- Preserve password/MFA, customer history, session revocation, invitation replacement/acceptance/delegation and all existing data. Unknown original outcomes remain the durable-receipt gap ADM-55.

## Gate

Native desktop/mobile concept review before runtime edits;320–1920 responsive/Axe checks; search/customer promotion/staff invitation/revocation/paging/filter/empty/error/denied/stale/unknown/reload/identity cases; focused shared acceptance and workforce invitation regressions; exact receipt units; production build; isolated API/connected verification with additive retained fixtures and no external delivery. Do not mark milestone90 accepted before these checks pass.
