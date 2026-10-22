# Managed workforce orders — milestone 109

Status: locally accepted on 20 October 2026. Route `/admin/workforce/orders`. The full application redesign goal remains active.

## Outcome

A dedicated searchable queue and selected-order workspace replace repeated preparation forms and raw statuses. Order/product search, status and fulfillment filters combine within current branch scope. Validated URL state preserves filters, cursor history and selection through reload and Back. Named branches, payment-recorded facts, product quantities and recorded progress provide the context each permitted responsibility can use.

Operations can review preparation of paid collection orders from Confirmed to Processing to Ready. Customer Service and Sales Supervisor see read-only details; unpaid, delivery, pending, ready and terminal records expose no preparation form. The existing release, payment, delivery, inventory and aftercare authorities remain separate. Private contacts, money amounts and unrelated identifiers are excluded from this workforce projection.

Review shows the exact next state and note, checks fresh access and current order state, then validates the exact actor/version/state/reason receipt. Changed records require explicit adoption of a retained draft. Unknown outcomes, including post-dispatch 408/429, remain locked across reload until current inspection and independent reconciliation. No automatic resend occurs.

## Design gate

Four native baselines preceded fresh built-in Image Gen desktop and phone concepts. The first phone concept was rejected for tablet-like horizontal fields; the corrected phone reference stacks record facts. Accepted images, prompts and the [locked specification](workforce-orders-oct-concepts/spec.md) are retained in the repository.

The implemented page uses the actual branded shell, Quicksand interface, compact headings, visible field borders, red focus treatment, 44px controls and restrained cool surfaces. Desktop uses an inline filter bar, six-column table and items/progress beside preparation. Phone layouts stack filters, labeled record facts and selected-order content. Dates explicitly use Lagos time; selection moves focus to the order heading.

Native reference comparisons retain the intended hierarchy and responsive composition. Intentional differences are the actual logo/navigation/fonts, accessible control dimensions, flat red primary buttons, ink outlined view controls, semantic status colors, valid cursor controls and real fixture data. The phone has two records rather than the illustrative one; intrinsic content height follows those records and complete timestamps. The existing shell and accessible spacing make the desktop page taller than the generated reference. No decorative imagery or fabricated activity is added.

## Verification

| Gate                     | Evidence                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page behavior            | 24/24 production-browser cases: combined filters, selection, paging/reload/Back, exact sequential preparation, stale preflight, retained drafts, read-only roles, noneligible states, failed/denied/mismatched reads, empty/loading states, invalid URL, lost/malformed/408/429 recovery and 320px keyboard/long-content behavior. |
| Responsive/accessibility | Seven widths: 320/375/430/768/1024/1280/1440px, Axe scans and keyboard review pass. Final native captures at 430/768/1280/1440px and full-page composition were compared against the accepted concepts; no horizontal overflow.                                                                                                    |
| Regression               | Nine checks pass: forbidden URLs, permission loading/revocation, four existing workforce queues, complaint/enquiry replies and job-detail technical review. The shared orders fixture now reflects its current response contract.                                                                                                  |
| Helpers                  | Seven query/scope/receipt helpers and two pending identity/storage/redaction units pass.                                                                                                                                                                                                                                           |
| API/database             | Six distinct scenarios pass across guarded runs, with 13 successful reads, three retained updates and 16 audits. Original rows and owned financial/item fields are preserved; temporary sessions removed. See the [backend contract and evidence](../../../backend/docs/workforce-orders-workspace.md).                            |
| Connected browser/API    | Operations at 430/1440px: real 25+8 queue paging/reload, two exact preparation updates, committed-lost-response recovery without replay, 22 audited reads/24 audits, unchanged originals and stable financial/item fields, zero temporary sessions.                                                                                |
| Static/build             | Frontend/backend type checks, focused lint/format, OpenAPI/types/inventory, 315 paths and 370 operations plus four infrastructure routes pass. Production webpack build/standalone preparation pass; ten runtime/generated source hashes match the tested snapshot.                                                                |
| Runtime health           | Four final captures verify page identity, meaningful content, selection closure and filtering, with no page errors, console warnings/errors or unexpected failed API/assets. Canceled known Next.js RSC navigation/prefetch requests are recorded separately.                                                                      |

Two synthetic fixture setup failures rolled back fully; required delivery and terminal-state fields were corrected. API verification then uncovered a real generic-query parsing bug, fixed by parsing order queries only with their dedicated schema. Disabled-account and previously advanced fixture expectations were corrected with guarded selective resumes. No successful order update was repeated. Final lint also corrected unused destructured names in the preservation helper without changing test behavior.

## Files and evidence

Frontend: `app/components/workforce-orders.tsx`, `workforce-order-detail.tsx`, `workforce-orders.css`, reused complaint layout CSS, exact-route dispatch and shell breadcrumb handling, `lib/admin/workforce-orders.ts`, `workforce-order-pending.ts`, API pending redaction, generated types/inventory, fixtures and browser/unit tests. Backend: `workforce-order-workspace.ts`, compatible workforce routes/schemas/service, generated OpenAPI and integration tests. No schema or migration changed. Backend gap ADM-77 records scope and remaining boundaries.

External evidence is retained under `C:/Users/PC/.codex/workforce-orders-*`: baseline/final/native images, final health JSON, API logs/preservation files, connected checkpoint/before/results/captures, source hashes and distinct Playwright output directories. The tested production snapshot is `work-aftercare-final-build-71fff5772e544bb9a6d8a896f129758d`; build evidence is `work-reservation-build.log`. Synthetic fixtures remain retained.

## Safety and remaining work

Before test writes, the actual isolated target `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test` and restricted runtime privileges were verified. Unchanged earlier migration replay/db:check evidence was reused. No application/shared database, schema/migration, existing grant, backup/restore, provider activation, commit/push or deployment operation ran. Populated synthetic order money/item fields are preserved; payment/refund/invoice fixture tables are empty, so populated financial-ledger preservation was not newly established.

Browser-session uncertainty markers do not replace durable original-operation receipts or cross-device recovery. Physical devices, Safari/Firefox, production-scale data and deployed acceptance remain unverified. Deploy the compatible API before its frontend and verify the target separately.

Next page: `/admin/workforce/finance`, followed by central owner checklist consolidation, remaining route inventory, application-wide role regression and deployed acceptance. This local gate does not complete the overall goal.
