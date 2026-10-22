# Managed workforce job detail — milestone 105

Route: `/admin/workforce/jobs/[id]`. Locally accepted on 19 October 2026 as milestone 105. The application-wide goal remains active; this is not deployed acceptance.

## Delivered behavior

The detail workspace separates the named job overview and recorded findings from technical editing, independent quality review and lead assignment. Booking and work states are labeled separately. Breadcrumb and Back to jobs preserve validated queue filters/paging. The existing dashboard shell, Quicksand, ink/red palette, compact type and accessible control sizes are retained.

Technical changes contain only changed notes and a permitted progression. Existing notes cannot be silently cleared. Custom validation identifies/focuses the affected field and links its error; native required/length constraints remain. Harmless refresh preserves drafts; changed records require explicit replacement. Denied, failed, mismatched and expired access hides retained job facts and controls.

Assignment uses scoped server search and 25-record cursor pages. Selected staff remains identifiable across pages/search. Complete staff references distinguish duplicate names in choices, the retained selection and exact confirmation. Fresh preflight rechecks actor, scope, record revision and selected eligibility; server locks and expected versions remain authoritative. Closed jobs cannot be assigned or edited. Quality approval requires an independent reviewer and attributed workers.

All three changes use exact review/receipt validation. Actor-bound pending metadata persists before sending and contains no notes/reasons/customer facts. Refresh/reload does not clear uncertainty. Fresh inspection and explicit independent reconciliation are required; the UI does not replay a mutation or claim that current state proves an original request outcome. Durable server receipts/cross-device idempotency remain unimplemented.

## Evidence already completed

All 33 distinct page browser cases have passing evidence across the initial and focused runs. The final field-error production build passed 13 focused checks, including seven-width layout/Axe, two lead Axe widths, exact technical submission, custom-error focus/description/invalid state, duplicate-name assignment and error-state Axe. The latest build and standalone preparation exited successfully; 13 runtime/generated-contract source hashes match the running snapshot. Completed API business actions were not repeated for the final accessibility-only change.

- Initial page browser run: 21 passed; four ambiguous harness selectors were corrected and those four passed separately. Six additional cases cover candidate eligibility loss, unknown states, two lead Axe widths, empty/failed search and automatic access expiry. The refined production build passed 16 focused cases. Staff-reference refinement passed seven focused cases, including a new duplicate-name case at 320px. Repeated cases are not additional distinct coverage.
- Nine affected-route regressions passed: five workforce access/navigation scenarios, jobs paging/detail return, overview alias and two notification/session scenarios.
- Seven detail helper units and two pending-storage units passed. The seven helpers passed again after typed field-error refinement. Frontend/backend type checks, scoped lint/format and generated-contract checks passed. OpenAPI remains 313 paths/367 operations plus 4 infrastructure routes.
- Four API read scenarios verified minimal private references, scope denials, actual eligible-candidate paging/search and query validation. Eight reads produced eight READ audits; original hashes across 14 domain tables matched and temporary sessions were removed.
- Four API mutation scenarios verified seven changes/seven UPDATE audits: start, awaiting parts, resume, quality handoff, two assignments and independent completion. CSRF, role/scope, invalid input, stale revision, invalid progression, self/unattributed review and closed-job changes were rejected. Original hashes across 15 domain tables matched; three dedicated synthetic jobs remain and temporary sessions were removed.
- Connected production Edge → Express → PostgreSQL verified assignment, work start, quality handoff and independent completion: four changes/four UPDATE audits. The third response was withheld after commit; reload/refresh kept the lock, independent record/audit reconciliation cleared it, and no change was resent. Original hashes across 19 domain tables matched, including the earlier API-test rows. One additional synthetic job remains; a subsequent read confirms both records completed and no owned temporary sessions.

The connected run resumed after a duplicate-name selection exposed ambiguous labels, then resumed only quality approval after an external browser route-teardown race. Three precisely identified test sessions from the interrupted process were removed before the final resume. The mutation segments recorded 17 + 4 READ audits; the initial name-selection segment recorded 3 more. No completed business action was repeated. The API setup also resumed after adding a missing required timestamp to a synthetic IN_PROGRESS fixture. Original failure/checkpoint evidence is retained. These are passing resumed checks, not an uninterrupted first-pass claim.

## Concept comparison

References: [desktop](workforce-job-detail-oct-concepts/desktop.png), [mobile](workforce-job-detail-oct-concepts/mobile.png), [lead actions](workforce-job-detail-oct-concepts/lead-actions.png), and the [preimplementation specification](workforce-job-detail-oct-concepts/spec.md). All three local references and final native captures were inspected: technician at430/768/1280/1440 and lead at430/1440. Captured routes/titles match, meaningful content and enabled intended controls are present, and no framework overlay, horizontal overflow, console/page errors, clipped controls or unreadable labels were observed. Final lead captures use two candidates for readability; 27-candidate paging is covered separately. First-build screenshots are preserved under a separate prefix.

| Reference requirement                             | Implementation and intentional adaptation                                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Compact job heading, service subtitle and refresh | Actual shell and Quicksand replace generated approximations; 28px desktop/24px mobile headings.                                                 |
| Separate work/booking state and named facts       | Real states, branch, staff, Lagos schedule and vehicle references; no financial/admin fields.                                                   |
| Desktop overview/editor split                     | Approximately42/58 at sufficiently wide content; stack below 1050px content width.                                                              |
| Mobile hierarchy                                  | Overview precedes action form; facts stack below 640px, controls remain at least 44px and long references wrap.                                 |
| Technical editor                                  | Visible borders, two 120px note areas, explicit progression; default is Keep current state rather than the incorrect generated desktop label.   |
| Quality and assignment                            | Existing findings are not duplicated into nested cards; scoped name search, radio options and named paging match the lead concept.              |
| Search alignment and navigation                   | Field margin specificity corrected; search button/input align. Breadcrumb/Back links underlined.                                                |
| Staff identity                                    | Full references intentionally added after real duplicate names were encountered; reference is present in accessible selection and confirmation. |

## Environment, artifacts and limits

Production Next.js snapshot on `http://localhost:3070`, Edge via Playwright. Browser plugin unavailable; the installed Playwright workflow is the fallback. Local mocked browser cases verify UI states; connected cases use the real API and isolated PostgreSQL.

Before database writes, actual target verified as `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, test environment, restricted runtime role without elevated privileges, database/table ownership or TRUNCATE. Financial tables were empty; populated financial preservation was not newly established. Existing 60-migration replay/db-check evidence is reused because no schema changed. No shared/application database writes, schema/grant changes, backup/restore rehearsal, provider activation, push or deployment occurred.

External evidence in `C:/Users/PC/.codex/`: `workforce-job-detail-baseline-*`, `workforce-job-detail-first-build-*`, `workforce-job-detail-final-*`, `workforce-job-detail-e2e-results`, `workforce-job-detail-corrected-results`, `workforce-job-detail-refined-results`, `workforce-job-detail-regression-results`, `workforce-job-detail-final-assignment-results`, `workforce-job-detail-final-validation-results`, `workforce-job-detail-read-api-*`, `workforce-job-detail-actions-api-*`, setup-failure evidence, `workforce-job-detail-real*.json`/screenshots and `workforce-job-detail-source-hashes.json`.

Actual API paging covers two eligible records and UI fixtures cover 27. Performance and real traversal beyond 100 records were not established. Deployed acceptance, physical devices, Safari/Firefox, remaining workforce routes, owner-checklist consolidation and application-wide role regression remain open. Deploy the compatible backend before the frontend.
