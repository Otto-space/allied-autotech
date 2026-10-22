# Milestone 101 — refund timing implementation record

Route `/admin/refund-timing`; 19 October 2026. **Accepted locally** in [milestone 101](work-refund-timing.md). This file preserves the implementation record; the acceptance document is authoritative. Goal remains active.

## Completed evidence

- Four baseline widths inspected, fresh built-in desktop/mobile/form/review concepts saved, audit/specification written before runtime edits.
- Compatible private current endpoint with version-first refund semantics, current actor/session checks, bounded history and atomic READ audit. Publication now checks the current actor under the access lock. Generated contracts: 313 paths, 367 operations, four infrastructure routes.
- Complete current/scheduled/latest calendar interface, grouped approval form, retained draft bases, fresh consent, fresh preflight, exact Q6 receipt and persistent uncertain recovery.
- Seven frontend parser/recovery units pass. Backend four isolated API scenarios and three existing owner-calendar units initially passed; the later sparse-calendar correction adds the fourth calendar unit below. Original rows unchanged; temporary sessions removed. No schema change.
- Initial production build found a client-directive ordering mistake; corrected before browser validation. Rebuilt production passed.
- All 25 distinct browser cases have passing evidence: original 23 cases (21 first run, two timeout cases passed focused repetition) plus maximum 366-holiday list and failed-refresh/draft case. The interrupted run stalled at 768 then failed to launch Edge at 1280; both passed unchanged in the focused run. Seventeen distinct Axe scans pass (seven page/review pairs, failed/denied reads, maximum calendar review). Original failure traces retained.
- Connected production Edge/API/PostgreSQL passes two deliberate future publications, exact receipt/success focus/draft retirement, cancellation with zero writes, committed lost response, reload/read reconciliation without replay. Exactly two POSTs/two CREATE audits, 12 supporting READ audits, 650 previous policies unchanged, current calendar unchanged, no page errors and zero temporary sessions. Financial/order/refund tables are empty; do not claim newly tested populated refund preservation.
- First native implementation captures at 430/768/1280/1440 plus mobile form/review inspected: no overflow or page errors. Twelve runtime source hashes matched that build.

## Final presentation refinement — completed

Native comparison required reducing the breadcrumb bottom gap to 8px, preventing tablet refresh-button wrapping and enforcing the 112px textarea height against general dashboard rules. These are CSS-only changes. Existing accessible modal behavior is documented as the intentional mobile concept adjustment; no shared review rewrite.

Final build session 65804 completed with both steps exiting 0 using the established production snapshot. Its helper/log retains the historical `work-reservation-build` name. Final server runs at port 3070; all seven responsive cases passed in session 70095 after the CSS-only changes. Native captures were regenerated/inspected and 12 source hashes matched. No API/connected mutations were repeated. A later arithmetic-only correction replaces the 1,000-day search cap for valid sparse calendars; four owner-calendar units and final backend type/lint/format checks passed. Existing selection/saved-deadline guards remain unchanged.

## Evidence locations

All external artifacts under `C:/Users/PC/.codex/`:

- `work-refund-timing-e2e-results` (original 21 pass/two browser timeouts), `work-refund-timing-e2e-focused-results` (two pass), `work-refund-timing-e2e-boundary-results` (two pass).
- `work-refund-timing-api-tests.log`, `work-refund-timing-api-fixtures.json`, `work-refund-timing-api-preservation.json`. Output filename typo was corrected by copying its existing successful result; no repeat writes.
- `work-refund-timing-real.json`, `work-refund-timing-real-before.json`, `work-refund-timing-real-progress.json`. Guarded connected harness must not rerun completed mutations.
- `work-refund-timing-final.cjs`, `work-refund-timing-final-*`, `work-refund-timing-source-hashes.cjs/json`.

Frontend final typecheck/focused lint passed after new tests. Backend typecheck/focused lint passed. Touched formatting and diff whitespace pass. Reuse unchanged database migration replay/privilege evidence; no shared-data write, backup/restore or deployment happened.

Acceptance `work-refund-timing.md`, quality index 101 and ADM-70 now record the evidence and deployment/receipt limits. Managed-workforce integration and whole-application/deployed checks remain after this gate; the owner decision hub is proposed consolidation, not an implemented capability.
