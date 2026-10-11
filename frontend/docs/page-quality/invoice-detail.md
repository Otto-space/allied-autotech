# Customer invoice detail and financial documents

Status: local acceptance passed, 8 October 2026; nineteenth expanded milestone. Scope: `/dashboard/invoices/[invoiceId]`, customer invoice PDFs and verified payment-receipt PDFs, plus their download/share controls. This report does not certify the staff invoice page, every payment-page entry point or deployment.

## Audit and implementation

The original customer invoice page exposed summary amounts and directly related payments, without an itemized document or download/share actions. The backend lacked the requested document projection and PDF routes. Baselines were captured at 390, 768, 1280 and 1440 pixels before three fresh [ImageGen concepts](invoice-oct-concepts/README.md) and production implementation.

The page now combines an invoice sheet, a dark amount/status summary, related-record navigation, payment requests and eligible receipts. Mobile places the amount summary before the paper; tablet uses a compact two-column summary; larger screens place it beside the invoice. Breadcrumbs use the invoice reference. The shared dashboard shell suppresses its redundant breadcrumb only on this detail route. Nippo provides display identity and Quicksand provides interface text and financial numerals.

The customer-only document service independently enforces ownership and excludes drafts. It uses persisted amounts in integer kobo, immutable snapshots for newly created invoices, and reconciled source records or an explicit subtotal-only fallback for legacy invoices. Both administrator invoice creation and checkout-created drafts write the snapshot in their existing transaction. A database trigger prevents subsequent snapshot changes. Historical customer names or catalogue prices are not invented to fill missing data.

The invoice projection includes payment requests through the direct invoice relation and its order or vehicle transaction. Receipts require the payment's selected successful, verified settlement attempt with matching currency and amount. Completed refunds are reported separately. A receipt does not claim delivery, service completion or full invoice settlement. Uploaded evidence and pending manual reports are insufficient.

Four authenticated routes, with `/api/v1` omitted:

| Route                                                  | Response                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `GET /customers/invoices/{invoiceId}/document`         | Typed invoice, line items, totals, source-linked payment requests and eligible receipts |
| `GET /customers/invoices/{invoiceId}/download`         | Private invoice PDF                                                                     |
| `GET /customers/payments/{paymentId}/receipt/document` | Typed confirmed-payment receipt                                                         |
| `GET /customers/payments/{paymentId}/receipt`          | Private receipt PDF                                                                     |

Documents use `Cache-Control: private, no-store`; PDFs add attachment filenames, `nosniff` and document identity headers. The renderer uses bundled licensed Quicksand fonts, with no remote HTML or image fetching. Requests and document sizes are bounded: 200 invoice lines/payment requests, 50 PDF pages and 4 MiB. Exceptional histories fail for account review instead of returning a misleading truncated document.

Download controls verify response identity, media type, PDF signature and size. They clear or abort on account changes. Sharing prepares the private file, then requires an explicit user gesture for native sharing. Unsupported or restricted browsers retain PDF download and an authenticated account-page link. Native cancellation is reported without claiming delivery. The dialog traps focus and restores it to the share control.

Invoice payment preparation retains the review step, rechecks current server state before a new write, validates the returned payment target and amount, and retains the original idempotency key after uncertain outcomes. Active source-linked payment requests suppress a new preparation action. Existing server payment rules remain authoritative.

## Verification evidence

- Backend type checking, lint, compilation and OpenAPI validation passed: 255 paths, 303 documented operations and four infrastructure routes. All 39 focused document and commerce security/boundary tests passed.
- Frontend full lint, type checking and the final production build/standalone packaging passed. All 16 focused download and shared mutation-review unit tests passed.
- Final browser run: all 41 cases passed (34 invoice-quality scenarios and seven existing invoice regressions). An earlier combined run passed 75 cases, including 36 order-detail regressions, before the final source-linked history contract and restricted-share detection changes. This is cumulative regression evidence, not one 77-test command.
- Invoice coverage includes the ten widths 320/360/375/390/430/768/1024/1280/1440/1536; Axe scans at 390/768/1440 and on a 320-by-420 sharing dialog; keyboard focus; pending/paid/void states; legacy and long content; inconsistent totals; stale/error/session behavior; reviewed payment creation and uncertain-response recovery; native file sharing, cancellation and fallback; and source-linked pending payments. Final captures showed no horizontal overflow or page errors. All three concepts and final responsive captures were visually compared.
- A real authenticated browser downloaded invoice and receipt PDFs against the updated local API and displayed the linked successful order payment, with zero page errors. Both files passed the PDF signature check. Native operating-system sharing was not used to send these synthetic files to anyone.
- Real isolated API/database checks used synthetic records in `allied_vehicles_qa` on PostgreSQL port 55439. They exercised checkout-created snapshots, draft privacy, customer/role denial, profile-change isolation, database snapshot immutability, pending-receipt rejection, synthetic administrative settlement, source-linked payment history and authorized JSON/PDF reads. No real funds or external provider delivery are claimed.
- The final API proof uses invoice `6f328910-96cb-47eb-bdad-897e36851dd4` and payment `2dc0a640-e78b-467c-9ae4-233955f291df`, for NGN 26,875.00. Logs and temporary scripts remain outside the application in `C:/Users/PC/.codex/invoice-oct-*`.
- The compiled backend renderer loaded the runtime fonts successfully. Actual invoice and receipt PDFs were rendered and visually inspected; both are one A4 page. A six-page long-description fixture and a void invoice were also inspected. Extracted financial text is checked against server amounts; PDF currency is spelled `NGN` to avoid a missing currency glyph.

## Concept comparison and corrections

| Comparison point     | Implemented decision                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice hierarchy    | Retain the concept's white paper, red top rule and dark amount summary.                                                                         |
| Mobile layout        | Stack the summary and payment action on narrow screens; retain a two-column summary only where space permits.                                   |
| Financial typography | Use Quicksand numerals after the first render showed that Nippo made the amount unnecessarily blocky.                                           |
| Metadata density     | Four fields across on wide desktops, two across on narrower paper; long references wrap.                                                        |
| Itemization          | Preserve readable descriptions, quantities, unit amounts and totals at 320px without hiding amounts.                                            |
| Brand and content    | Use the approved tagline and “beside Kilimanjaro”; remove generated slogans, green status, blue links and invented tax percentages.             |
| Payment history      | Keep one useful empty-state explanation; remove the redundant empty receipt panel and show confirmed receipts when available.                   |
| Sharing              | Use an accessible modal with an explicit native share action, download and a copyable authenticated link; restore keyboard focus after closure. |
| Printable documents  | Preserve the concept's restrained invoice table and dark receipt amount panel; use repeatable page identity and numbered footers.               |

## Deployment and remaining scope

Apply `20261008140000_invoice_document_snapshot` through the normal deployment process before running the dependent backend. It has been applied only to the isolated QA database. Deploy the backend contract before the dependent frontend, regenerate Prisma as part of the build, and package `backend/assets/fonts` (the Dockerfile now copies it). Retain the included OFL license. Legacy snapshots remain null; the migration deliberately does not fabricate a backfill.

Target-environment cookie/proxy behavior, private cache headers and downloads still require deployed acceptance. Native operating-system recipient delivery is not established by browser capability fixtures. Public document links, email delivery, operational staff exports and legal/tax certification are outside this implementation. Receipt shortcuts on other account pages remain subject to their own integration review. Saved/favourites and remaining application pages still require separate gates.

The existing administrator invoice regression also exposed a filter-clear defect: clearing the form reloaded its saved filter draft. The fix removes only the current identity/path's invoice-filter draft before remounting. All seven existing invoice scenarios passed; this is a functional regression fix, not acceptance of the staff invoice page's visual design.
