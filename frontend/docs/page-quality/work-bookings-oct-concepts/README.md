# Workshop bookings design specification

Prepared 12 October 2026 before production changes. Route `/admin/bookings`; STAFF, ADMIN and SUPER_ADMIN. Gate 49 was locally accepted after implementation and final comparison; see the [acceptance report](../work-bookings.md).

Fresh [desktop](desktop.png) and [mobile/state](mobile-states.png) concepts govern the complete list, filtering, paging, empty, error and stale views. Baseline captures: `C:/Users/PC/.codex/work-bookings-oct-before-{1440,390}.png`. Browser plugin unavailable; Playwright/Edge fallback.

## Extracted system

- Existing Allied logo, shell, navigation and account remain authoritative. Quicksand throughout; title 28px desktop/24px mobile, section 18px, body 13px, metadata 12px; 44px controls, 8px radius, 20px gutters.
- Ink `#01121A`, red `#E60301`, white surfaces and cool gray canvas. Neutral status labels. No photographic asset is needed for operational records.
- Breadcrumb: ordered list, Overview link, proper chevron, Workshop bookings with aria-current. Suppress the older shell breadcrumb only on this route.
- Allowed heading/copy: Workshop bookings; Manage appointments, quotations and work orders within your permitted branches.; Refresh bookings.
- One filter toolbar: Booking status, Appointment from, Appointment to, Apply filters, Clear filters; Inclusive dates / Lagos time / Up to 366 days. Branch & staff filters disclosure supplies real administrator branch/staff choices and staff own-assignment filtering. No unsupported search, sorting or total counts.
- Ink Booking records strip, actual page count, applied status/date/scope summary; ruled six-column desktop table, full labelled rows below tablet width, no independent card grid. Service/appointment/ref, branch, status, staff, vehicle/registration, View booking.
- Pagination persists current cursor and bounded previous trail in URL; filters reset paging and support reload/Back/Forward. API never receives the UI trail. No private records in browser storage.
- Loading skeleton, authentic empty view, failed/denied read with safe error and retry, retained background data with stale notice, fresh filter results and query validation. Manual errors hide old records. No new mutations; booking detail remains the action surface.

## Contract and concept corrections

`GET /staff/bookings` permits status, branchId, assignedStaffId, scheduledFrom inclusive, scheduledTo exclusive, UUID cursor and limit. Convert inclusive Lagos date inputs to exact UTC boundaries; enforce at most 366 days. Server scopes STAFF to its active assigned branch, ADMIN/SUPER_ADMIN to all permitted records. The records are ordered by identifier, not appointment date. Directory choices use existing administrator endpoints, including inactive branches and staff for historic filtering; STAFF uses its own profile only. Do not invent customer names, pagination totals or deposit requirements.

Preserve actual branding/type and the existing sidebar instead of generated substitutes. Desktop concept heading is oversized: use 28px. Mobile description must keep the supplied permitted-branches wording. The results strip remains ink on mobile. Generated sample values are test-only. Use the backend safe-error wording, single coherent filter submission, and real record-order guidance. Branch/staff choices page independently; do not imply the first directory page is complete. Staff is assigned one branch, not the concept's plural claim. Own-assignment is optional; no assignment mutations here.

## Acceptance record

The pre-implementation acceptance checklist was: verify roles, dates/timezone boundaries, all statuses, URL recovery, paging, choices errors/pagination, record links, invalid/duplicate/out-of-scope responses, loading/empty/error/stale states, session invalidation, long labels and keyboard behavior. Capture 320/360/375/390/430/768/1024/1280/1440 plus native desktop and landscape. Compare both concepts with final renders on six fidelity points. Run appropriate unit/browser/backend checks, real browser/API/database isolation, lint, type and production build. These checks are complete for this page; results, corrections, six-point fidelity comparison and evidence limitations are recorded in the linked acceptance report. The application-wide goal remains active.
