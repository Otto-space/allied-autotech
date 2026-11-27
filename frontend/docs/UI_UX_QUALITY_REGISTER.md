# Dashboard UI/UX quality register

## 2026-11-27 — Workforce booking detail redesign (implementation checkpoint)

**Scope:** `/admin/workforce/bookings/[bookingId]` — workforce/admin booking detail route.

**Branch:** `codex/workforce-booking-details-redesign-20261127`

### Implemented in source

- Replaced the vertically stacked list link, title and refresh action with a compact breadcrumb, page heading and responsive action toolbar.
- Added a distinct appointment summary with booking status, scheduled time, service, customer, phone, vehicle, branch, assigned staff and duration.
- Added responsive desktop two-column operational layout; collapses into a single column on tablet and mobile.
- Retained existing attendance, attendance history, quotation, work estimate, work review, timing review, reschedule, alternative-time and confirmation components.
- Preserved the existing permission predicates, workforce scope checks, mutation review flows, optimistic-version gates and API calls.
- During background refresh or refresh failure, the last verified booking remains mounted and visible but becomes inert. This preserves local form drafts while preventing actions against a record that may be stale. Initial loading, initial read errors, scope changes and minimum-version verification continue to withhold the record.

### Files changed

- `frontend/app/components/workforce-booking-detail.tsx`
- `frontend/app/components/workforce-bookings.css`
- `.goals/dashboard-modernization/goal.md`
- `frontend/docs/UI_UX_QUALITY_REGISTER.md`

### Verification status

| Check | Status |
|---|---|
| Source changes written to isolated branch | Complete |
| Permission/business logic preserved by component reuse | Source inspection only |
| Formatting | Not run |
| ESLint | Not run |
| TypeScript | Not run |
| Unit tests | Not run |
| Playwright role/workflow tests | Not run |
| Responsive browser verification | Not run |
| Accessibility audit | Not run |
| Production build | Not run |
| Staging screenshots | Not captured |

### Outstanding review

1. Verify at 320, 360, 390, 768, 1024, 1366 and 1440 CSS pixels.
2. Exercise STAFF, ADMIN and SUPER_ADMIN with existing authenticated fixtures.
3. Verify refresh and reconnect preserve drafts and that controls remain inert until a fresh, permitted record is verified.
4. Exercise attendance, quotation author/reviewer separation, payment/deposit presentation, estimate review, rescheduling and confirmation.
5. Inspect Allie and WhatsApp floating controls in the rendered detail page; no global widget implementation was changed in this checkpoint.
6. Capture desktop/tablet/mobile screenshots and record results here.

**Release state:** Not committed, not merged, not deployed. No production data or live payment was touched. This checkpoint does not complete the wider dashboard modernization goal.
