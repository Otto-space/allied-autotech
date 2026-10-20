# Booking capacity — local acceptance, milestone 98

Accepted locally for `/admin/booking-capacity` on 19 October 2026. The full application goal remains active. Next separate route: delivery setup `/admin/delivery-policy`.

## Result

The owner selects a workshop and inspects its current effective policy, next scheduled policy, latest recorded version and bounded version history. A dedicated private backend read selects effective records independently of history. The editor preserves the supported daily limit, opening weekdays, fixed Lagos appointment hours, closed dates, written provenance and optional future effective time. Empty branches have no invented limits or opening days. Inactive branches remain inspectable and cannot receive an approval.

Drafts and uncertain approvals are isolated by account, role and branch. Branch selection survives reload in the URL. Refresh retains unsent values and the original version; a changed base requires explicit reload. Publication rechecks identity, branch status/revision and policy version, validates exact Q5/actor/branch/settings receipts, and retires the successful draft. Lost responses remain locked through reload and branch switching until independent reconciliation; current facts do not prove the original outcome and no publication is automatically replayed.

The compatible backend endpoint and actor/branch publication checks are documented in [the contract](../../../backend/docs/capacity-policy-workspace.md). Publication does not confirm/reschedule bookings, change existing bookings or replace resource review. No schema change is needed.

## Design and browser evidence

Four native baseline widths, contract audit and three fresh built-in ImageGen concepts preceded runtime edits. See [audit](work-capacity-oct-concepts/audit.md), [specification](work-capacity-oct-concepts/spec.md), [desktop](work-capacity-oct-concepts/desktop.png), [mobile and review](work-capacity-oct-concepts/mobile-review.png), [form detail](work-capacity-oct-concepts/form-detail.png), and [prompts](work-capacity-oct-concepts/prompts.md). Established sequential Playwright/Edge fallback was used because browser-plugin access was unavailable.

All 24 distinct production-browser cases have passing evidence: seven responsive/accessibility widths (320/375/430/768/1280/1440/1920), empty publication with exact request, branch-specific drafts/reload, stale-base refresh, four fresh preflight changes, two uncertain outcomes, explicit rejection, calendar validation, four failure/empty/inactive states and two restricted roles. Seven page and seven review Axe scans plus four state scans passed. The final red-checkbox CSS correction received another mobile review Axe scan and four native captures with computed-colour assertions, no overflow and no page errors. The interrupted first run completed 15 cases; the remaining run passed seven, and the two role tests passed after correcting their expected denial text. No runtime permission change was needed for those assertions.

Native screenshots at 430/768/1280/1440 and mobile form/approval/review details are retained as `C:/Users/PC/.codex/work-capacity-final-*`. The visual comparison confirms:

| Area                    | Implementation and contract-corrected concept                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy               | Ordered breadcrumb, clear page title, branch choice, named workshop context, current state and approval editor.                                                     |
| Layout                  | Desktop 38/62 columns, stacked mobile/tablet, full-width evidence, no page overflow.                                                                                |
| Typography and controls | Existing Quicksand dashboard, 30/24px page title, 20px sections, 16px inputs, 48px fields and minimum 44px actions.                                                 |
| Calendar                | Seven full weekday labels wrap safely, Sunday-first order is preserved, fixed hours are facts, red checks match the form concept.                                   |
| Current and history     | Real versions and effective times replace contradictory generated examples; compact disclosures expose scheduled settings and provenance.                           |
| Review                  | Exact branch/calendar/date/source/evidence/version, safe initial focus, Escape/cancel return, narrow-screen scrolling and stacked actions reuse the accepted modal. |
| Surfaces                | Cool canvas, white bordered state/editor, six-pixel corners and restrained red follow the established dashboard.                                                    |

The existing shell and truthful full dates are retained. The workshop context/impact row adds space compared with the generated desktop but identifies the selected branch and consequences explicitly. Generated editable hours, source dropdown, extra brand heading and fabricated next/latest states were not adopted.

## Verification and preservation

Five policy/receipt/recovery units pass. Backend typecheck/lint, frontend typecheck/focused lint, OpenAPI export/validation/route coverage, generated API types/inventory, formatting of touched runtime files and production build/standalone packaging pass. Thirteen runtime/dependency SHA-256 comparisons match the built snapshot. Contract coverage is 310 paths, 364 operations and four explicit infrastructure routes.

Five isolated API scenarios have passing evidence across initial and focused continuation runs: current selection outside bounded history with concurrent audited reads; role/MFA/query/missing-branch rejection; inactive history/publication and CSRF; invalid limits/calendar; and one successful concurrent publication with one conflict and one matching Q5 audit. Two setup attempts failed before inserting fixtures because required branch fields were missing; those fixtures were corrected. Inactive publication correctly returns 409. The audit links the policy through `newValues.policyVersionId`, not `entityId`. The successful concurrent write was retained and verified read-only rather than repeated. A later read assertion was updated for the now-published version 103. Passing evidence is in `work-capacity-policy-api-continuation.log` (four cases) and `work-capacity-policy-api-tests.log` (one focused read case).

Before database writes the harness verified test environment and restricted runtime at `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`. Original 65 users, 57 staff profiles, 328 policy versions, 517 audits, 38 branches, three bookings and existing financial/privacy/hold records remained hash-unchanged. Synthetic fixtures were retained; temporary sessions remaining: zero.

Connected production Edge/Express/PostgreSQL verified review cancellation, exact receipt, retired draft and success focus, then a committed lost response followed by reload, fresh inspection and independent reconciliation without replay. Exactly two future approvals and two publication audits were recorded, with 14 supporting READ audits. All 431 pre-existing policy versions, 65 users, 57 staff profiles, three bookings, 40 branches and financial/privacy/hold snapshots remained unchanged; the current effective policy was unchanged. No page errors and zero temporary sessions remained. Evidence: `work-capacity-policy-real.json` and its guarded progress/before files. Do not rerun the completed mutation harness.

Existing unchanged migration replay/db:check/privilege evidence is reused. This gate ran no migrations, schema changes, application/shared database writes, grant changes, provider actions, backup/restore rehearsal, push or deployment. Local PostgreSQL was restarted after the test services stopped; its existing data was preserved.

## Remaining work

ADM-63 includes optional durable original-request publication receipts for branch capacity. Deployment acceptance is still open. The recommended central owner decision checklist is separate proposed consolidation work; this page already lets the owner supply supported capacity settings in the dashboard without chat approval.
