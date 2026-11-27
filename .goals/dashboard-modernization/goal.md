# Goal: Modernize every Allied AutoTech dashboard

## Outcome

Build one accessible, responsive, premium and plain-language dashboard experience for customers, staff and administrators. Operational reliability comes before decorative refinement. This goal remains open until the authenticated route and state inventory has been reviewed and verified, not merely restyled.

## Priority and acceptance

1. [ ] **P0 — Staff booking stability.** Reproduce and eliminate disruptive background-refresh flicker, lost focus and draft resets on staff and workforce booking details. Verify permission changes still revoke inaccessible records and mutation versions remain authoritative. Test desktop, narrow laptop and mobile, including slow responses and tab return.
2. [ ] **P1 — Workshop operations.** Simplify Service Centre, booking lists/details, technician assignment, workshop resources, capacity, scheduling, quotation review and work orders. Ensure allowed actions and next steps are understandable to nontechnical staff.
3. [ ] **P1 — Financial journeys.** Align booking, Paystack deposit status, payments, invoices, refunds and disputes with verified backend state. Preserve live-payment gates, roles, amounts and audit controls.
4. [ ] **P2 — Shared design system.** Consolidate navigation, typography, spacing, black/red semantic colors, responsive sidebar, forms, tables, progress indicators, dialogs and all feedback states before broad page-level overrides.
5. [ ] **P2 — Every role and route.** Audit all authenticated customer/admin/workforce pages, nested views, links, menus, forms and tables against `frontend/tests/quality/dashboard-pages.txt` and `frontend/docs/UI_UX_QUALITY_REGISTER.md`.
6. [ ] **P2 — Profiles, policies and mobile.** Improve profile editing and secure photos, consolidate policy navigation without changing policy substance, verify keyboard, screen-reader-relevant semantics, 320/375/390/768/1024/1440 layouts and text zoom.
7. [ ] **P3 — Visual polish.** Refine sophisticated progress timelines, balance, alignment, hierarchy, density and purposeful motion after the critical journeys are reliable.

## First implementation batch

- Source observation: `WorkforceBookingDetail` removes the entire record and its forms while `useResource` performs a background refresh on tab visibility or reconnect. This can cause visible flicker and lost in-progress input.
- Candidate fix: preserve the mounted record during background refresh or a recoverable refresh error, while still withholding it on initial load, access-scope changes and an unconfirmed post-mutation version.
- Verification: focused unit regression, TypeScript, lint, and real authenticated staging observation are separate gates. The candidate must not be marked fully accepted before hosted interaction testing.

## Progress rules

- Record each route, role, viewport, initial state, source fix, test result, hosted result and remaining limitations in the existing quality register; avoid duplicating that register here.
- Mark only directly verified criteria complete. Preserve critical security, database and release safeguards in `AGENTS.md`.
- Use small reviewable batches, signed commits and the approved staging-first release process. Do not deploy production or turn on live payments under this goal alone.
- Resume at the highest-impact unfinished criterion on future Allied AutoTech work.

## Source brief

Owner-supplied **Allied AutoTech Dashboard Modernization Goal**, 27 November 2026.

## Workforce booking details redesign — implementation checkpoint

- [x] Created isolated branch `codex/workforce-booking-details-redesign-20261127` from the previously verified dashboard modernization checkpoint; no production branch or deployment changed.
- [x] Reworked the workforce booking detail page header into a compact breadcrumb, clear title and grouped navigation/refresh actions.
- [x] Reorganized appointment, customer, vehicle, branch, assigned staff and duration information into a responsive summary.
- [x] Established a two-column desktop operational workspace that collapses to tablet/mobile layouts.
- [x] Kept the existing attendance, quotation, work-estimate, timing, rescheduling, alternative-time and confirmation components and their existing permission/business logic.
- [x] Changed background-refresh presentation so the last verified booking remains visible; the record becomes inert during refresh errors or permission verification, preventing edits against stale data while preserving mounted form state.
- [ ] Verify the visual result against authenticated staging at all required viewport widths.
- [ ] Add/complete focused workforce detail browser coverage for refresh draft preservation, role permissions, attendance, quotation and timing workflows.
- [ ] Run repository formatting, lint, typecheck, focused unit/e2e tests and production build; record exact outcomes before review.
- [ ] Review the quotation/payment composition and Allie/WhatsApp floating controls in the actual page layout; preserve their shared implementations and payment controls.
- [ ] Capture desktop, tablet and mobile screenshots and update the quality register with evidence.

This is an implementation checkpoint only. It is not a completed acceptance or release. No commit, push to a release branch, merge, deployment, production-data mutation or live payment was performed.
