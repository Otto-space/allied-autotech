# Delivery setup — local acceptance, milestone 99

Accepted locally for `/admin/delivery-policy` on 19 October 2026. The full application goal remains active. Next separate route: vehicle reservation agreements `/admin/reservation-terms`.

## Result

The Super Admin can inspect the current effective delivery policy, next scheduled policy, latest recorded version and bounded history. The dedicated private read selects effective records independently of history and evaluates checkout/delivery availability within the same database snapshot. Approval and checkout readiness remain distinct.

The editor supports the complete list of 1–100 delivery areas with separate name, city, state and exact before-tax NGN fee fields. Zero is valid; fees are converted without floating-point rounding. Stable area identities, added/removed rows and the original policy base survive draft reload. Empty drafts have no invented delivery areas or prices. The approved collection address remains read-only and uses “beside Kilimanjaro.”

Review shows the complete replacement list, collection address, effective date, source, written evidence and new version. Publication performs fresh identity/version checks, validates exact nested Q1/actor/settings receipts and retires the successful draft. Uncertain outcomes remain locked through reload and require independent reconciliation without automatic replay. Current facts cannot prove the original request outcome; durable receipts remain ADM-63.

See [backend contract](../../../backend/docs/delivery-policy-workspace.md). Existing order snapshots and fulfillment calculations remain unchanged. No schema migration is required.

## Design and browser evidence

Four native baseline captures, contract audit and two fresh built-in ImageGen concepts preceded runtime changes. See [audit](work-delivery-oct-concepts/audit.md), [specification](work-delivery-oct-concepts/spec.md), [desktop](work-delivery-oct-concepts/desktop.png), [mobile/form/review](work-delivery-oct-concepts/mobile-form-review.png) and [prompts](work-delivery-oct-concepts/prompts.md). Sequential Playwright/Edge fallback was used because browser-plugin access was unavailable.

All 26 production-browser cases passed: seven responsive page/review widths (320/375/430/768/1280/1440/1920), zero/maximum exact fees, add/remove identities through reload, structure-only draft changes, empty policy/draft restoration, the 100-area limit, four invalid fee forms, changed identity/version, lost/wrong-actor receipts and reconciliation, availability states, failed/denied reads and Staff/Admin access boundaries. Seven page and seven review Axe scans plus two failure-state scans passed.

Final native 430/768/1280/1440 screenshots, mobile form/approval details and mobile review are retained in `C:/Users/PC/.codex/work-delivery-policy-final-*` and `work-delivery-policy-review-430.png`. All four native widths report no overflow or page errors. Visual inspection against both concepts and the contract-corrected specification confirms:

| Area                  | Inspected result                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy             | Ordered breadcrumb, compact title/subtitle, neutral refresh and current/editor headings remain clear.                                                            |
| Layout                | Desktop current/editor columns follow the 38/62 structure; tablet/mobile stack without horizontal overflow.                                                      |
| Typography and fields | Quicksand interface, restrained heading sizes, visible input borders, 48px fields and comfortable actions follow the specification.                              |
| Area editing          | Each area has four separate labelled fields, paired on desktop and stacked on mobile; complete actual rows replace illustrative concept content.                 |
| Current facts         | Both exact fees retain before-tax context; availability, fixed collection address, effective version and checked time are readable.                              |
| Review                | All areas, exact fees, address, provenance, effective time and new version fit the scrollable modal; mobile actions stack with clear cancel/approve distinction. |
| Surfaces              | Cool canvas, white bordered sections, six-pixel field corners and restrained red action agree with the established dashboard.                                    |

The actual Allied navigation/logo and existing accessible review modal are retained. Complete dates, availability explanations and two real fixture rows take more vertical space than the illustrative concept. Generated merged city/state fields, shield icons, extra cards and dashed red Add treatment were not adopted, as recorded in the pre-implementation specification.

## Verification and preservation

Five policy/receipt/recovery units pass. Backend/frontend type checks, focused lint, touched-file formatting, OpenAPI export/validation/route coverage, generated frontend contracts/inventory, production build and standalone preparation pass. Thirteen runtime/dependency SHA-256 comparisons match the production snapshot. Contract coverage is 311 paths, 365 operations and four infrastructure routes.

Three isolated API scenarios passed: consistent current/readiness projections and concurrent audited reads; role/MFA/query/CSRF and typed area/fee/address rejection; and one successful concurrent Q1 publication with one conflict and one matching CREATE audit. Before writes, the harness verified test environment and restricted runtime at `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`. Original 65 users, 57 staff profiles, 433 policies, 543 audits, three bookings and 40 branches remained hash-unchanged. Synthetic fixtures were retained and temporary sessions removed. Evidence: `work-delivery-policy-api-tests.log` and `work-delivery-policy-api-preservation.json`.

Connected production Edge/Express/PostgreSQL verified cancellation without publication, one exact future approval with draft retirement/success focus, then a second committed approval whose response was lost. Reload, fresh inspection and independent reconciliation produced no replay. Exactly two publication POSTs/two CREATE audits and 12 supporting READ audits were recorded. All 436 pre-existing policies and the existing account/booking/branch snapshots were preserved; the current effective policy stayed unchanged. No page errors and zero temporary sessions remained. Evidence: `work-delivery-policy-real.json` and its guarded before/progress artifacts. Do not rerun the completed mutation harness.

Financial/order tables are empty in this isolated fixture: unchanged hashes do not prove preservation of populated financial/order records for this gate. Existing unchanged order-snapshot behavior and its earlier evidence were reused rather than claiming a new populated checkout test.

Existing migration replay, db:check and privilege evidence is reused because schema/grants are unchanged. This gate ran no migration, application/shared database write, grant change, provider action, backup/restore rehearsal, push or deployment.

## Remaining work

Deployment acceptance and ADM-63 durable original-request publication receipts remain open. The central owner decision checklist remains proposed consolidation work; this page already allows supported delivery decisions to be entered in the dashboard. External courier payment collection and its implementation implications remain separate owner decisions.
