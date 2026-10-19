# Operational order aftercare

Locally accepted 17 October 2026 — milestone 62.
Route: `/admin/orders/[orderId]/aftercare`.

## Implemented experience

The existing operational component now uses the accepted dashboard shell, a named
order breadcrumb, compact heading/actions, factual guidance, three-part order
summary, request history and a separate review/evidence rail. Desktop uses a 3:2
composition. At narrower widths the single selected review form follows its request;
controls are not duplicated. Records retain complete reasons, products, quantities,
actual receipt/inspection/decision facts, reviewed fees and refund deadlines. A
reviewed fee is explicitly distinguished from a refund. Terminal requests and
requests without an authorised next action have no unusable review control.

Receipt and inspection remain operational actions. Approval/rejection require the
current financial-policy approval grant. The page validates the current account,
role, active profile, assigned Staff branch and matching order/history before
enabling writes. A fresh order/history/profile comparison precedes every POST;
changed or unavailable access blocks submission. Denied or mismatched access removes
private records; transient refresh failures preserve clearly blocked prior facts.

The existing reviewed mutation dialogs, draft support and field validation are
reused. Cancel sends no mutation. Before a POST, a verified account/order-scoped
session marker stores only the operation and, for review, the request UUID. Storage
failure blocks submission. Unknown or contradictory responses lock further changes,
including after reload. Explicit recovery reads saved records and clears the lock
without replaying the mutation. A private direct request read can recover the
affected request even when it has fallen outside the latest-100 history window.
Fulfilment evidence remains a one-time actual event/reference record.

Customer aftercare keeps its separately accepted component. Its only shared-contract
adjustment is a truthful fallback for a missing historical branch.

## Concept and render comparison

Fresh [desktop](work-aftercare-oct-concepts/desktop.png) and
[mobile](work-aftercare-oct-concepts/mobile.png) concepts were generated and inspected
before implementation. The [extracted specification](work-aftercare-oct-concepts/spec.md)
records intentional changes to generated branding, copy and controls. Browser/IAB
was unavailable; verification used Playwright with Edge, Axe and direct image review.
Concepts and final native-width desktop, 390px, 320px and viewport-dialog renders were
inspected together after the final CSS correction.

| Comparison point     | Final result                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and navigation | Real Allied branding, established authorised navigation/search and named order breadcrumb replace generated branding and invented links.                                |
| Hierarchy and type   | Quicksand, controlled dashboard heading/body sizes and compact controls follow the extracted specification.                                                             |
| Palette and summary  | Pale canvas, white three-part summary, blue factual guidance, ink text and red primary review action are retained. Neutral statuses follow the established system.      |
| Desktop structure    | History left and review/evidence right; all actual fields remain readable. The inherited nested form borders/padding were removed after visual inspection.              |
| History content      | Actual count and latest-100 disclosure; complete facts and restrained separators replace generated record numbers, fabricated customer decisions and fake detail links. |
| Mobile sequence      | Stacked summary and facts, then the selected request's single review form, remaining history and evidence. Narrow screens use separate surfaces as specified.           |
| Forms and dialog     | Visible borders, full-width narrow-screen controls, review before save and complete cancel/confirm actions; final viewport dialog has no clipping.                      |
| Recovery states      | Explicit blocked pending state and saved-record reconciliation extend the same visual system without automatic replay.                                                  |

The final render follows the extracted specification. Real branding, compact type,
neutral statuses, actual record copy and mobile record surfaces are documented
intentional differences from the generated images. No material visual mismatch
remains in the checked renders.

## Verification evidence

- **74 distinct browser scenarios have passing evidence:** 23 new operational cases,
  28 customer quality regressions and 23 existing customer/Staff regressions. The
  combined run passed 70; four legacy recovery cases passed in a focused rerun after
  their obsolete order-heading locator was updated to the new summary. The 23 new
  cases also passed in the earlier focused run. No full-suite repeat followed the
  CSS-only correction.
- New cases cover Staff/Admin/Super Admin/Customer boundaries, receipt/inspection/
  approval availability, permission revocation before POST, cancellation/focus,
  one-time evidence and Lagos time, lost/contradictory/uncommitted outcomes for both
  writes, reload locks, recovery outside recent history, storage failure before
  POST, retry/denial/mismatch/empty states and long responsive records.
- **11 frontend unit cases passed** across the new operational contract and existing
  aftercare recovery helpers: parsing, matching, stages, permissions, stable
  comparison and minimal pending markers.
- **Eight backend cases passed** across aftercare and Staff order discovery. The new
  case verifies direct recovery outside 100 recent requests, private headers,
  anonymous/customer/unassigned/no-MFA denial, inactive-branch rejection for Staff
  reads/review/evidence and administrator historical access. Denied actions do not
  mutate the records.
- **26 captures and associated Axe scans passed:** widths 320, 360, 375, 390, 430,
  768, 900, 901, 1023, 1024, 1280, 1440, 1467 and 1920; native 1387×1134 viewport;
  unselected, Staff, empty, history error, denied, unavailable permission, approval,
  saved evidence, review dialog, pending and landscape. The final CSS change then
  passed six focused captures/Axe scans at 320, 390, 768, 1024, native desktop and
  mobile dialog. All had zero page overflow, browser errors or Axe violations. The
  new long-content case adds eight responsive Axe scans. Final full-page captures
  begin at scroll position zero; the dialog uses a viewport capture.
- **Real production-browser/Express/PostgreSQL verification passed:** customer
  return intake, receipt, condition inspection, explicit NGN12.50 approved fee with
  a separate live financial grant, four audited actions, cancel with zero writes,
  committed-response loss for receipt and evidence, reload and explicit recovery
  without replay, direct saved-request access, customer denial and private no-store
  headers. Inventory, inventory transactions, order status and recorded payment
  stayed unchanged; no browser errors occurred. The helper was corrected to POST
  the existing CSRF endpoint and await completion of recovery before selecting the
  next action; these were harness corrections, not product fixes.
- Full frontend lint, TypeScript, scoped formatting and production build passed.
  The final CSS rebuild passed; nine implementation hashes match its production
  snapshot. Backend lint/typecheck, formatting, generated OpenAPI/types, contract
  validation (**269 paths**) and route coverage (**322 operations**) passed.

## Backend and release boundary

[ADM-16](../../../BACKEND_IMPLEMENTATION_GAPS.md#adm-16---operational-aftercare-recovery-and-branch-scope-implemented-local-acceptance)
adds the private direct request lookup and aligns aftercare Staff access with the
assigned active-branch rule. Existing review/evidence mutations keep their business
semantics, CSRF, expected-state and audit checks. Approval still does not cancel an
order, restock goods or execute a refund. Deploy the additive backend endpoint before
the frontend that uses it for explicit recovery. History browsing remains bounded
to the latest 100 requests; the direct recovery read does not add historical paging.
ADM-15's original delivery-VAT breakdown and owner-policy boundaries remain open.

Verification used only newly created local database
`allied_work_aftercare_20261017_test` on `127.0.0.1:55480`, after cluster identity and
database absence checks. Empty replay of all existing 58 migrations and `db:check`
passed. Separate runtime credentials were verified without ownership, schema CREATE,
table TRUNCATE or administrative role attributes. Synthetic domain fixtures remain
preserved; the real-browser helper removed only its own synthetic sessions.

No schema migration, application/shared/staging/production data or grant change,
backup operation, restore rehearsal, off-device recovery verification or deployment
occurred. Local acceptance does not establish target-environment acceptance.

Private evidence lives under `C:/Users/PC/.codex/work-aftercare-*`: build, browser,
backend, migration/safety and real-API logs; captures/manifests; source hashes and
test helpers. Credentials are excluded from repository reports.

Next separate page gate: product inventory `/admin/inventory`, then its detail route.
The full application goal remains active.
