# Operational order detail — gate 61

Locally accepted 17 October 2026 at `/admin/orders/[orderId]`. The separately
addressable aftercare review page is next. Application-wide, financial-policy and
deployed-environment acceptance remain open.

## Delivered behaviour

The existing `StaffOrderDetail` now presents a named breadcrumb and reference heading,
independent fulfilment/payment/method summary, historical item lines, customer and
collection/delivery information, saved totals and actual dated activity. Desktop uses
two columns; mobile retains every field in labelled rows and places activity last.
Missing delivery details, phone, tax, invoice, line items or branch have truthful
fallbacks. Displayed money uses the existing exact Kobo formatter and dates use Lagos
time. Values are not recalculated from current prices or policy.

Staff/Admin/Super Admin retain the existing order access. Invoice links are limited
to administrators and require an actual linked invoice. Staff do not fetch financial
endpoints or full aftercare history. Customers make no operational requests. UUIDs
are checked by the server route; invalid IDs render the existing not-found screen
without a detail API request. Next.js may stream that screen with HTTP 200 rather
than 404; acceptance checks the rendered boundary and absence of an order request.

The backend now supplies `allowedTransitions` on private direct reads and successful
status changes. This reflects current status, recorded payment and approved
cancellation review. The editor exposes those actions, validates cancellation
reasons, reviews human-readable facts and rechecks the operational record immediately
before submitting its observed version and CSRF token. Cancellation and status
changes do not imply payment/refund settlement.

Unknown outcomes persist a minimal account/order-scoped pending marker through
reload. Explicitly loading the saved order clears the pending change without
resubmitting it. Storage contains no customer information or reason text. If browser
storage is unavailable, in-memory locking and backend version checks still apply;
cross-reload persistence then cannot be guaranteed. Known rejection disables repeated
confirmation; returning to the form permits reviewing the refreshed record. Session
invalidation aborts outstanding requests and removes the review state.

Transient refresh failure retains disclosed stale information and disables editing.
Denied/missing or mismatched records remove private details. Malformed records,
duplicate items and contradictory transition arrays cannot become actionable data.

## Design and fidelity

Fresh [desktop](work-order-detail-oct-concepts/desktop.png) and
[mobile](work-order-detail-oct-concepts/mobile.png) concepts preceded implementation.
The [extracted spec](work-order-detail-oct-concepts/spec.md) records allowed copy,
tokens, component structure, role scope and required departures from generated art.
Browser/IAB is unavailable; Playwright with installed Edge supplied the screenshots.
Both concepts and final native desktop, 390px, 320px and dialog renders were inspected
with `view_image`. The native desktop viewport is 1402×1122; the full-page capture
also includes content below that viewport. The mobile concept is an enlarged raster,
so real mobile widths were verified directly.

| Comparison             | Evidence and disposition                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and orientation  | Real Allied logo and authorised navigation retained; one named breadcrumb and exact reference. Generated phone chrome/search copy omitted.                 |
| Typography and density | Accepted Quicksand 28/24px heading, 18px sections and 12–13px controls/content; no oversized generated title.                                              |
| Summary                | Ink three-part desktop band and readable mobile rows; each label/value uses valid definition-list markup.                                                  |
| Items and delivery     | Four desktop column meanings retained in labelled mobile rows; actual SKU/customer/branch/address fields, without invented descriptions or location facts. |
| Totals and actions     | Ink saved-value heading, recorded subtotal/discount/VAT/delivery, private invoice link and server-authorised form with visible borders/focus.              |
| Activity and aftercare | Only actual timestamps; one working aftercare link. Mobile sequence matches the extracted spec.                                                            |
| Review and recovery    | Focus restores after cancel, pending outcomes remain locked, and viewport dialog inspection shows no clipping or visible skip link.                        |

Primary copy matches the extracted spec. Additional cancellation, missing-data and
recovery guidance is explicitly required workflow copy. The implementation was
faithfully verified against that specification; no material visual mismatches remain.
Real branding, compact typography, neutral statuses, mobile summary contrast and
two-column mobile item facts are the documented intentional differences.

## Verification evidence

- **40 distinct browser scenarios have passing evidence:** 22 new detail cases,
  17 order-discovery regressions and the existing Staff list-to-detail transition.
  The final combined build run passed 39; its unpaid-order test passed after adding
  an explicit wait for the asynchronously loaded selector. Earlier QA exposed and
  fixed summary definition-list semantics and review focus restoration; test-only
  corrections distinguished Next route prefetch from privileged API reads and
  verified the streamed not-found boundary.
- **24 frontend unit cases passed** across detail and discovery contracts, including
  available transitions, duplicate/invalid records, snapshot comparison, timestamps,
  exact query scope and reason validation.
- **8 backend cases passed** across discovery/detail, phase-four transaction flow
  and API boundaries. The new detail case covers all six statuses, payment gating,
  approved cancellation availability, branch/customer rejection, private projection,
  status audit, version conflict and CSRF. Synthetic historical fixtures were
  corrected to include required timestamps and cancellation reasons.
- **26 captures and Axe scans passed:** 14 widths (320, 360, 375, 390, 430, 768, 900,
  901, 1023, 1024, 1280, 1440, 1467, 1920), native desktop, Staff, delivery, error,
  denied, malformed, mismatch, review, pending, unpaid, terminal and landscape.
  No capture overflow, page errors or Axe violations. A separate 390×844 viewport
  dialog capture and Axe scan confirmed “Go back” focus and no visible skip link;
  a full-page screenshot had shown an off-viewport fixed-element capture artifact.
  Detail and discovery long-content/reduced-motion cases add sixteen Axe scans.
- **Real production-browser/Express/PostgreSQL passed:** direct named read, saved
  VAT, server action availability, cancellation with zero writes, reviewed/versioned
  status change, two audited changes, committed response loss, reload and explicit
  recovery without replay, Staff branch/invoice isolation, customer denial, private
  no-store headers and zero browser errors.
- Frontend full lint and final focused lint, TypeScript, formatting and production
  build passed. Backend lint/typecheck, formatting, OpenAPI validation (268 paths)
  and route coverage (321 operations) passed. OpenAPI/types were regenerated. Ten
  implementation/dependency hashes match the final tested production snapshot.

## Database, policy and release boundary

Only the newly created local PostgreSQL database
`allied_work_order_detail_20261017_test` on `127.0.0.1:55480` was used. Cluster
identity and database absence were checked before creation. Empty replay of the
existing 58 migrations and `db:check` passed. Separate runtime credentials were
verified without ownership, schema CREATE, table TRUNCATE or administrative role
attributes. Domain fixtures remain preserved; tests removed only their own sessions.

No application/shared/staging/production data or grants changed. No new schema,
backup operation, restore rehearsal, off-device backup verification or deployment
occurred. Deploy the additive backend response before the corresponding frontend.

The order response currently provides aggregate `taxKobo`; it does not provide an
original product/delivery VAT split. The page labels that amount “VAT (as recorded)”
and does not invent a split or apply today's policy to historical orders. The
owner-policy rounding/publication and courier-collection boundaries remain open.
ADM-15 in [the gap handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md) records the
original-breakdown follow-up for the finance audit. This local operational gate does
not close those application-wide finance requirements.

Private evidence is under `C:/Users/PC/.codex/work-order-detail-*`: build/test/API/
database logs, source hashes, real-integration output, screenshots and capture/dialog
manifests. Runtime credentials are private and are not included in these reports.
