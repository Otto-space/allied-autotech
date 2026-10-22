# Reservation agreements — local acceptance, milestone 100

Accepted locally for `/admin/reservation-terms` on 19 October 2026. The full application goal remains active. Next separate route: bank refund timing `/admin/refund-timing`.

## Result

The Super Admin can inspect the current effective agreement, next scheduled revision, latest recorded revision and bounded history. Current/next selections are independent of the latest 100 history entries. Closed schedule summaries show revision, publication/withdrawal status and full effective time, so a forthcoming withdrawal is visible without opening history. Exact agreement text remains readable as plain text in a scrollable disclosure; unapproved, withdrawn and empty states do not imply availability.

The editor shows only fields relevant to publication or withdrawal, while preserving both action drafts and their original base through switching, refresh and reload. It requires fresh approval consent, reviews the exact text/reason and provenance, checks the current account/version, validates exact Q3/actor/settings receipts and retires successful drafts. Interrupted approvals remain locked through reload and require independent reconciliation without automatic replay. Existing customer acceptance and payment rules remain intact; publishing an agreement does not activate deposits. Later scheduled revisions still apply after a withdrawal.

The compatible private workspace endpoint and current actor publication check are documented in [the backend contract](../../../backend/docs/reservation-policy-workspace.md). No schema migration is needed. Durable original-request receipt lookup remains ADM-63; current-state inspection cannot prove an interrupted request's original outcome.

## Design and browser evidence

Four native baseline captures and contract audit preceded two fresh built-in ImageGen concepts and the implementation. See [audit](work-reservation-policy-oct-concepts/audit.md), [desktop](work-reservation-policy-oct-concepts/desktop.png), [mobile withdrawal/review](work-reservation-policy-oct-concepts/mobile-withdrawal-review.png), [specification](work-reservation-policy-oct-concepts/spec.md) and [exact prompts](work-reservation-policy-oct-concepts/prompts.md). The sequential Edge/Playwright fallback was used because the Browser plugin is unavailable.

All 30 distinct production-browser scenarios have passing evidence: 22 dedicated workspace cases and eight existing agreement cases. Coverage includes seven page/review widths, exact literal publication and withdrawal, draft retirement, retained action drafts, fresh consent, stale draft base, fresh identity/version, lost/wrong-actor receipts through reload and reconciliation, empty/current-withdrawal states, long text, invalid controls/past scheduling, read failures and restricted roles. Existing customer cases preserve explicit acceptance, original-request recovery after withdrawal, stale-agreement rejection and consent clearing.

The initial run passed 28 cases; two assertions incorrectly expected different wording than the shared error catalog. Those assertions were corrected and both passed a focused rerun. Runtime behavior was unchanged. Seventeen dedicated Axe scans passed: seven page/review pairs plus current withdrawal and failed/denied reads.

Native inspection identified two final presentation corrections: closed schedule summaries now expose status/date, and form focus uses brand red. The final production build passed, followed by all seven responsive page/review cases with explicit scheduled-fact visibility and computed focus-colour checks. The final native 430/768/1280/1440 captures and mobile withdrawal form/approval/review details report no overflow or page errors and are retained as `C:/Users/PC/.codex/work-reservation-policy-final-*`.

| Area                 | Final comparison with the contract-corrected concepts                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hierarchy            | Ordered breadcrumb, compact title/subtitle, neutral refresh, impact note and named current/editor sections.                                                        |
| Layout               | Desktop 38/62 current/editor columns; tablet/mobile stack without horizontal overflow.                                                                             |
| Current and schedule | Exact current title/text, checked time and visible next/latest revision/status/effective dates distinguish a scheduled withdrawal from a later approved agreement. |
| Forms                | Separate publication and withdrawal fields, readable Quicksand textareas, visible borders, 48px inputs, brand-red focus and fresh approval checkbox.               |
| Long text            | Literal content and paragraph breaks survive draft/review; large documents scroll safely and do not render HTML.                                                   |
| Review               | Exact action/text/reason/date/source/evidence/revision, safe focus/cancellation and clear stacked mobile actions reuse the established modal.                      |
| Surfaces             | Cool canvas, white bordered sections, restrained red actions and neutral scheduling notices match the page family.                                                 |

The actual Allied utility shell/logo, full timestamps, genuine supported values and existing accessible modal replace generated simplifications. Generated legal clauses, approval references, past draft dates, monospace fields, blue focus and amber notice styling were not adopted, as recorded before implementation. Customer agreement CSS remains unchanged.

## API, persistence and safety evidence

Six frontend parser/recovery units pass. Backend/frontend type checks, focused lint, touched-file formatting, OpenAPI export/validation/route coverage, generated contracts/inventory, final production build/standalone preparation and 13 matching production source hashes pass. Contract coverage is 312 paths, 366 operations and four infrastructure routes.

Four isolated API scenarios passed: independently selected current/next agreement beyond bounded history with concurrent minimal READ audits; role/MFA/query/CSRF and invalid settings rejection; one successful concurrent Q3 publication with one conflict/audit; and a distinct scheduled withdrawal preserving earlier policy snapshots. Before writes, the harness verified test environment and restricted runtime at `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`. Original 65 users, 57 staff profiles, 438 policies, 561 audits, three bookings and 40 branches stayed hash-unchanged. Synthetic fixtures were retained and temporary sessions removed. Evidence: `work-reservation-policy-api-tests.log` and `work-reservation-policy-api-preservation.json`.

Connected production Edge/Express/PostgreSQL verified cancellation without publication, one exact future publication with draft retirement/success focus, and one future withdrawal whose committed response was deliberately lost. Reload, fresh inspection and independent reconciliation produced no replay. Exactly two POSTs/two CREATE audits and 12 supporting READ audits were recorded. All 542 pre-existing policies and original account/booking/branch snapshots were preserved; current effective agreement remained unchanged. No page errors and zero temporary sessions remained. Evidence: `work-reservation-policy-real.json` and guarded before/progress files. Completed mutation harnesses were not replayed after presentation-only changes.

Financial/order/vehicle transaction tables in this isolated fixture are empty. This gate does not newly prove preservation of populated historical customer acceptance or financial records. Unchanged acceptance behavior retains prior evidence and the affected customer browser checks above.

Existing migration replay/db:check/privilege evidence is reused because schema/grants are unchanged. No migration, application/shared database write, grant change, provider action, backup/restore rehearsal, push or deployment occurred for this page. Deployed acceptance remains open.
