# Customer booking detail design specification

Route: `/dashboard/bookings/[bookingId]`. Gate 32 passed local acceptance; see [the final report](../customer-booking-detail.md). These three fresh built-in ImageGen concepts were generated and inspected before production edits. [Prompts](prompts.md) preserve the complete inputs.

## Composition and tokens

- [Desktop](desktop.webp): existing dashboard shell; breadcrumb, heading and refresh; two-column appointment/deposit and service-progress region; appointment changes; full-width quotation document.
- [Mobile](mobile.webp): single-column appointment, deposit, recorded progress, changes, quotation. Quotation rows become labelled records without horizontal scrolling. Changes and cancellation are expanded only on request.
- [Review and recovery](states.webp): shared review dialog with exact facts, initial focus on Go back, blocked duplicate submission, bounded scrolling, uncertainty and loading/error variants.
- Cool gray canvas `#f4f6f8`; ink `#01121a`; white surfaces; red `#e60301`; readable muted slate `#536675`; control borders `#82939e`; separators `#dce3e8`. No gradients or photography.
- Quicksand for this operational screen: title 30px/1.2 (26px mobile), section 20px, subheading 16px, body 14px/1.65, labels 12–13px. Existing Nippo branding remains in the shell. Spacing 8/12/16/20/24; 10px panel radius; 44px minimum targets.
- Lucide outline icons: chevron breadcrumb 14px; refresh 16px; calendar, location, vehicle and notes 18px; decorative icons hidden from assistive technology. No extra image assets are required.
- Above-fold copy: existing shell; Overview / Bookings / actual service name; Booking details; Refresh booking; actual service/status; Appointment, Workshop, Vehicle, Your notes; Deposit and actual payment facts; Service progress and actual recorded events. Dynamic text comes only from verified API data.

## Deliberate corrections to generated details

Preserve the real logo, shell controls, navigation, search wording and signed-in identity. Exclude generated slogans, footer, device chrome, sheet labels, artificial close buttons and fictional person names. Use neutral status labels consistent with the accepted bookings list; do not invent success semantics from a color. Keep reschedule as a secondary button, and actual refund actions as buttons rather than tabs. Use the existing NGN currency formatter (naira symbol), not generated NGN spacing. The generated mobile diagnosis, completion dots and work-order timestamps are illustrative errors: show actual diagnosis, recorded booking timestamps only, and an undated work-order summary. Do not invent future steps or progress percentages. The empty quotation state stands alone only when there are no issued quotations. No notification promise is added. Retain shared help/WhatsApp support controls.

## Behavior and API inventory

Customer-owned GET detail, public booking policy and service-slot GETs already supply the data. Detail additionally consumes existing bookingSlotId and requested/confirmed/started/completed/cancelled timestamps. New detail parsing must not alter shared list contracts. Wrong-entity/malformed responses fail closed.

Customer mutations: POST cancel (reason, expectedVersion), PATCH schedule (slotId, expectedVersion), POST disruption-resolution (TRANSFER/REFUND, expectedVersion, optional slotId), POST quotation accept/reject (expectedRevision). Schedule and disruption require one stable idempotency key per reviewed intent. All mutations use CSRF and abort/discard on session change or unmount. Ordinary cancellation remains available for requested/awaiting-deposit/confirmed customer bookings. Backend transition/concurrency validation remains authoritative.

Reviews include the actual service, vehicle, appointment, requested replacement time, quotation revision/total/expiry or cancellation reason as applicable. Expired or undated issued quotations cannot be accepted/rejected. Check expiry again at confirmation. Loading, denied or failed reads do not expose stale actions; a failed background refresh retains readable facts with changes disabled. Missing policy provides retry and no invented terms. Slot results exclude the current slot and mismatched service/branch; pagination clears selection. Uncertain non-idempotent mutations require a fresh read before a new review; idempotent retries reuse the exact request and original key.

## Acceptance evidence

The linked final report records implementation, the nine-point fidelity ledger, ten widths, short-screen/dialog/Axe checks, session and transaction regressions, actual API/database acceptance, static checks and the register update. Concepts alone are not acceptance evidence.
