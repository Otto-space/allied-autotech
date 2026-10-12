# Workshop booking detail design specification

Prepared 12 October 2026 before production changes. Gate 50, `/admin/bookings/[bookingId]`, is locally accepted; see the [verification report](../work-booking-detail.md).

Three fresh built-in ImageGen concepts: [desktop](desktop.png), [mobile and states](mobile-states.png), [quotation and work-order continuation](records.png). Prompts requested the complete existing detail workflow, exact action/field labels, compact Quicksand typography, ink summary, ruled facts, paired operational forms, full mobile adaptation and state/review variants. Baseline captures live outside the repository at `C:/Users/PC/.codex/work-booking-detail-oct-before-{1505,390}.png`.

## Extracted system

- Preserve actual shell, logo and role navigation. Quicksand 28/24px title, 18px section headings, 13px body, 12px labels/metadata; 44px controls; 8px corners; 20px gaps; cool gray canvas, white forms, ink #01121A, red #E60301. Readable secondary text and visible login-derived input borders/focus.
- Entity breadcrumb: Overview, Workshop bookings, actual service name. Ordered list, proper chevron, current-page marker; safe loading title and long-name ellipsis. Full booking reference remains accessible in the summary, never used as the breadcrumb title.
- Manage workshop booking / Review the appointment, coordinate the team and record service progress. / Refresh booking. Ink service/status summary; appointment, branch, assigned staff and vehicle in ruled facts. Plain customer/internal notes. Historical deposit information remains available when present, without suggesting a new deposit requirement.
- Anchor navigation to available Assignment, Service progress, Quotations and Work order sections. Assignment and service progress use paired desktop forms, one column on mobile. Native disclosure for the exceptional business-disruption form. Preserve the existing quotation editor and authoritative totals; work-order notes paired on desktop. Line items become labelled records on mobile without losing values.
- Preserve confirmation/review dialogs, expected versions/revisions, CSRF, server pricing, separate payment handling and uncertainty recovery without automatic replay.

## Contract-driven concept corrections

Existing backend sources govern every action. STAFF can read its active branch, self-assign there, and confirm with BOOKING_CONFIRM even when not the current assignee. Other status transitions, quotation changes, disruption and work-order writes require assignment; administrators follow the existing role/capability rules. Authoring quotations also requires a staff profile. Do not render unauthorized controls merely to receive a server denial.

Generated sample content is not production data. Preserve actual status options and safe messages. Confirmation requires the existing resource-review text field, not the generated checkboxes. No invented work-order selector, manual tax rate, extra Open work order button or new branding/taglines. Quotation creation/editing retains its existing conditional layout and real catalogue picker. Notes are plain text in the summary, not editable fields. Status labels use neutral ink treatments instead of generated green/orange. Refresh remains usable in a stale state; mutations are disabled until a fresh record/access read succeeds. Permission failures clear private content. Existing financial history is retained as a separate conditional disclosure. All controls and original action labels remain accessible.

## Verification required

Role/assignment/capability matrix; all supported action payloads and review cancellation; stale/version conflict, failed/slow read, unknown mutation outcome and session invalidation; quotation and work-order regression; 320 through 1920 widths and landscape, long names/notes, keyboard/errors/dialogs, line-item mobile labels, reduced motion, Axe and clean production console. Real isolated browser/API/database writes and boundaries, lint/type/build. Reopen concepts and final captures for six-point fidelity ledger before local acceptance. No whole-application completion is implied.

The acceptance report records final checks, the six-point visual comparison, contract-driven deviations and local evidence. The application-wide goal remains active.
