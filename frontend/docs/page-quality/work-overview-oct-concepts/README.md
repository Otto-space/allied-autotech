# Work-dashboard overview specification

Prepared on 12 October 2026 before production changes. Route: `/admin`, for STAFF, ADMIN and SUPER_ADMIN. The specification preceded implementation; local acceptance is now recorded in the [page report](../work-overview.md), milestone 48.

## References and direction

Fresh [desktop](desktop.png) and [mobile, operations and states](mobile-operations-states.png) concepts follow the existing Allied shell. Baseline desktop, mobile, staff and expanded-monitoring captures are under `C:/Users/PC/.codex/work-overview-oct-before-*`. Browser/IAB is unavailable; use Playwright with Edge. Initial helper imports needed the repository's TypeScript loader and frontend path configuration; the corrected baseline capture passed.

The primary composition is a compact date toolbar, one ink metric band, chart/status panels and recent-record previews. Processing monitoring remains a separate, administrator-only disclosure loaded on demand. This is an operational page, so photography would compete with the task.

| Element       | Specification                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography    | Quicksand; 28px desktop / 24px mobile title, 18–20px section titles, 13–14px body and controls, 12px supporting labels.                                                                                                                        |
| Palette       | Ink `#01121A`, red `#E60301`, white, cool gray canvas/borders. Neutral status labels; red reserved for primary actions and attention.                                                                                                          |
| Header        | `Workshop overview`, explicit organisation or actual branch scope, outlined Refresh action. Preserve real brand/navigation/account chrome. Root overview is its own navigation destination.                                                    |
| Date controls | One bounded toolbar with Period, From, To, Apply dates and Lagos/inclusive/90-day explanation. 44px controls; wrap to two columns and then one where required.                                                                                 |
| Metrics       | Five connected ink cells, fine separators, actual counts/money. STAFF has quotations and stock additions instead of finance. Mobile monetary cells use full width.                                                                             |
| Activity      | Existing real daily chart, legend toggles, accessible day slider and data table. Red bookings, ink orders. Booking status meters use current statuses for the selected creation-date cohort.                                                   |
| Records       | Compact desktop booking table and orders rail; mobile booking rows expose service/date/status/detail action without losing fields to horizontal scrolling.                                                                                     |
| Monitoring    | Separate current-scope reads, independent of dates; summary counts/reconciliation, queue table, worker heartbeat table, oldest 100 unresolved alerts, overdue-record guidance and existing review links. No retry/expiry mutations added here. |
| States        | Loading, genuine zero, malformed/denied/failed read, retry, refreshing, visible stale-data notice, missing/overdue heartbeat, empty alerts/queues, session/role invalidation.                                                                  |
| Geometry      | 8px radii, 20–24px gaps/padding, 2:1 chart/status grid and compact records. At narrow widths use one column and readable ruled rows. No nested form frame.                                                                                     |

## Corrections to generated examples

Keep the actual Allied logo, shell navigation, search label and signed-in account instead of generated substitutes. The desktop chart keeps its existing legend and day slider; the extra chart date picker is not implemented. Preserve the four-order preview and five-booking limit, actual status labels and live records. The mobile chart compares bookings and orders, not inspections. Preserve the existing safe-error text and refresh behavior. No generated dates, amounts, percentages or branch assignments become production values.

Workers with a recent successful heartbeat are labelled `Recent success`, not `Running`: the API does not prove a continuously running process. Missing/overdue states come from server flags. Neutral styling replaces generated green/orange states. Alert messages come from the authorized endpoint, rendered as plain text; no invented recovery assurances. Existing overdue-record guidance remains authoritative. Preserve the entire selected date scope and separate settled-payment/refund totals; neither is net revenue.

## Contract and implementation boundaries

`GET /staff/overview?from=...&to=...` scopes STAFF to its assigned active branch and administrators to the organisation. It accepts inclusive Lagos ranges of 1–90 days from 2000 onward. No user-supplied branch filter is supported. The existing `/admin/operations/status` read is administrator-only and already returns queues, payment anomalies, reconciliation, worker heartbeat flags and open alerts. No backend endpoint or migration is required.

Keep client session invalidation, aborts, strict parsing and role checks. Disclose background refresh failures instead of silently presenting retained data as current. Date changes must never display data for a different returned range. Preserve automatic refresh/backoff and verify it for background failures and unfinished reads. Do not persist private aggregate data.

## Acceptance record

Completed checks cover all three work roles plus shared customer-overview regressions, dates/presets/invalid ranges, chart and daily data interaction, owned/scope-safe links, empty/loading/stale/error/retry states, malformed scope/range/monitoring data, role/account changes and lazy monitoring reads. Worker/alert fields were checked against the real API/database. Thirteen responsive widths, native concept size, operations/mobile states and six fidelity points were checked. Relevant browser/unit/backend tests, static checks and a production build passed; exact scope and retries are recorded in the page report. This specification does not close the whole-application goal.
