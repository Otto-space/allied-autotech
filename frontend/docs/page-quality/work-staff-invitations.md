# Promotions and invitations — local acceptance

Accepted locally19 October2026, milestone90. Route `/admin/staff/invite`. Next separate workspace: branch management; no dedicated frontend branch route currently exists. Application-wide and deployed acceptance remain open.

## Result

The page now presents a compact exact-email lookup, verified account name/current role/branch, separate customer-promotion and staff-invitation actions, responsive guidance and ruled invitation records. Status filtering and cursor history survive reload and Back; the searched email stays out of the URL. Secondary disclosures contain account/invitation references, lifecycle timestamps and the selected revocation proof form. Passwords are hidden initially, independently revealable, and cleared/re-hidden before review.

Current administrator identity gates private reads. Server-supplied eligibility controls the available actions. Scoped response validation rejects foreign, malformed, contradictory or non-advancing records. Fresh actor and selected-record inspection precedes each change; exact returned facts must match the reviewed operation. Failed reads support retry, stale background facts are labelled, and denied resource records are cleared.

A minimal actor-bound marker is persisted before submission. Lost or malformed outcomes lock further changes across reload without storing password, email or request body. Recovery requires fresh authorized inspection and independent reconciliation; no request is automatically replayed. Unavailable storage prevents submission. Local reconciliation is not proof of the original request's outcome.

## Design and fidelity

Four baseline widths preceded fresh built-in ImageGen [desktop](work-staff-invitations-oct-concepts/desktop.png) and [mobile](work-staff-invitations-oct-concepts/mobile.png) concepts. Native inspection, [audit](work-staff-invitations-oct-concepts/audit.md), [specification](work-staff-invitations-oct-concepts/spec.md), [prompts](work-staff-invitations-oct-concepts/prompts.md) and [corrections](work-staff-invitations-oct-concepts/corrections.md) preceded runtime edits.

| Comparison                    | Rendered result                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and breadcrumb          | Existing Allied navigation and Quicksand are retained. One semantic ordered breadcrumb marks the current page; generated operator/avatar/navigation details are omitted.                                                                                      |
| Desktop composition           | Lookup and selected-account proof occupy roughly three-fifths of the available width beside concise two-path guidance. Invitation records span the content below. At1440 the content begins at x292.                                                          |
| Mobile and tablet             | At430 the form stacks within16px page margins; guidance collapses. At768 the search remains paired, the account facts fit without clipping, and guidance follows the lookup.                                                                                  |
| Typography and forms          | Heading30px desktop/24px mobile,14px body,48px input heights and44px minimum action targets. Strong borders, visible focus and password visibility controls follow existing form conventions.                                                                 |
| Selected account              | Verified name/email/current role replace UUID-led content. Branch facts are explicit; raw references use a disclosure. Only the applicable promotion or invitation action appears.                                                                            |
| Invitation records            | Ruled rows replace repeated large cards. Actual role/status, full Lagos creation/expiry dates, secondary lifecycle facts and optional revocation proof remain available. Only loaded-page counts are displayed.                                               |
| Corrections during inspection | Scoped form selectors remove inherited excess field spacing and align desktop search input/button. The invitation filter and refresh action now align; refresh labels do not wrap. No invented delivery or role-transition claims were adopted from concepts. |

Final native viewport captures at430/768/1280/1440 were inspected with a selected staff account, plus the full desktop record layout. All four capture runs had no horizontal overflow, page errors or mutations. Evidence: `C:/Users/PC/.codex/work-staff-invitations-final-*`. Native viewport images support the fidelity assessment; full-page images are supplementary.

## Verification

- All28 distinct production browser scenarios pass:21 dedicated workspace cases and seven affected existing staff/invitation-acceptance cases. The initial25-case production run passed, followed by three additional error/storage cases; earlier development runs are not counted again.
- Responsive/Axe checks pass at320/375/430/768/1280/1440/1920 with WCAG2A/AA,2.1AA and2.2AA tags. Coverage includes current-identity mismatch/inactivity/denial, password clearing/re-hiding, named candidates, URL paging/reload/Back, invalid filters, foreign results, corrected searches, temporary/denied reads, unavailable storage, stale candidate/actor and lost/malformed response reconciliation. Existing promotion, invitation, revocation and acceptance/session-change scenarios remain working.
- Six focused unit cases pass for candidate eligibility, exact result scope/lifecycle, URL history and minimal recovery storage/redaction/identity boundaries.
- Frontend/backend type checks, focused lint and formatting pass. OpenAPI export/validation and mounted-route coverage pass; generated types are current. Production build and standalone preparation pass. Ten runtime/generated source hashes match the production snapshot.
- Fifteen focused API cases pass: two new inspection/eligibility cases,12 existing team-access regressions and one delegated-invitation acceptance case. See [backend evidence](../../../backend/docs/staff-invitations-workspace.md) for exact coverage and preservation counts.

## Connected verification and data safety

Production Edge, real Express API and isolated PostgreSQL completed four domain changes across two synthetic customers: two promotions, one administrator invitation and one revocation. Promotion preserved credentials/customer profiles, set the selected branch and revoked an existing customer session. Invitation created one outbox event and retained the Staff role until acceptance; revocation returned the selected record. Expected role/invitation/revocation audits were verified.

The second promotion committed before its response was deliberately lost. Reload kept changes locked, current account inspection preceded independent reconciliation, and exactly two promotion requests existed for the two distinct customers. No completed action was replayed and no password was stored.

Whole-row hashes confirmed all original53 users,5 customer profiles,48 staff profiles,17 invitations,12 outbox events,33 branches,1 capability grant,14 workforce-access rows and16 assignments unchanged. The two new customer profiles also remained unchanged. All three owned temporary sessions were removed; no page errors occurred.

All database writes used the retained isolated `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, whose empty migration replay, `db:check` and restricted runtime privileges were verified in the preceding milestone. This milestone confirmed the actual target/environment and non-elevated runtime before writes. No schema/migration, existing grants or application/shared database changed. No backup/restore, off-device recovery verification, external email delivery, push or deployment ran.

## Remaining limits

ADM-56 is implemented and locally verified. Optional durable original-request receipts remain ADM-55; current local recovery does not establish cross-device idempotency. Email queuing is verified, actual delivery is not. Branches, audit logs, processing jobs, remaining owner policies, role-specific regression and deployed-environment acceptance remain part of the active application-wide goal.
