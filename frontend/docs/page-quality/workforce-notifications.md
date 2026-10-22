# Workforce personal notifications — milestone 102

Accepted locally on 19 October 2026. Route: `/admin/notifications`. The complete redesign goal remains active; this closes ADM-66 locally, not deployed acceptance.

## User-visible result

Active workforce-managed STAFF and ADMIN accounts can open their own notifications through Settings, dashboard page search and the desktop notification bell. The existing accepted inbox and delivery-preference page replaces Access unavailable. Mobile retains the established navigation drawer and search; its header intentionally hides the bell. No additional operational page or permission is granted.

## Design and fidelity

Before runtime changes, all four managed-account baselines at 430, 768, 1280 and 1440px showed Access unavailable, no notification link and no notification reads. The full accepted milestone 97 desktop and mobile/recovery concepts and [specification](work-notifications-oct-concepts/spec.md) were re-inspected and reused. This targeted integration follows the builder skill's existing-design-system exception; no new page design or image generation was necessary. The [pre-implementation record](workforce-notifications-progress.md) defines the navigation and access changes.

Native final screenshots at those four widths, the mobile preference and review views, and the connected screenshot were inspected against the concepts:

| Comparison            | Result                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Information hierarchy | Exact My notifications heading, Overview breadcrumb, Inbox and Delivery preferences remain.                                                                    |
| Layout                | Flexible inbox and 340px preference rail on desktop; orderly stacked regions on tablet/mobile.                                                                 |
| Typography            | Existing Quicksand account typography, readable labels and compact heading scale retained.                                                                     |
| Palette and controls  | Ink shell/preference header, white regions, neutral visible borders, restrained red status/focus and confirmation retained.                                    |
| Navigation            | Actual workforce responsibilities replace incidental concept navigation. Settings expands around the active personal page; no legacy operational links appear. |
| Interaction states    | Existing review modal, keyboard cancel/focus, recovery lock, clear outcome and newer-preference preservation retained.                                         |
| Responsive behavior   | No horizontal overflow at any of seven tested widths. Mobile drawer/search substitute for the desktop bell according to the existing shell design.             |

No CSS or shared notification-region rewrite was needed. Existing milestone 97 concept corrections, real message data, exact confirmation wording and mandatory-message/marketing notices remain authoritative.

## Implementation and API

- `app/components/dashboard-shell.tsx`: permits the exact personal notification route after a matching verified workforce snapshot; shows the existing bell when access is verified.
- `lib/workforce-navigation.ts`: adds My notifications under Settings.
- `backend/src/modules/organization/workforce.policy.ts`: exact-path exception for the existing owned inbox, read-all, UUID-targeted read and current preference endpoints.
- New managed fixtures, browser tests, boundary units and authenticated integration tests cover the change.

GET `/staff/notifications`, POST `/staff/notifications/:notificationId/read`, POST `/staff/notifications/read-all`, GET/PUT `/staff/notifications/preferences/current` retain their existing schemas and behavior. No route, DTO, OpenAPI or database-schema change. Deploy the compatible backend exception with the frontend navigation change.

Personal account access does not depend on an operational assignment. Active unassigned or responsibility-revoked staff retain their own inbox; operational queues remain denied. Suspended accounts, revoked sessions and missing MFA remain denied. Strict input validation, account ownership, CSRF, private/no-store responses, preference version checks and original-request receipts remain enforced. Marketing delivery remains disabled.

## Verification

| Check                                       | Evidence                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New production browser scenarios            | 21 distinct cases pass: all eight templates, managed Admin, exact own writes, access-loading/denial/wrong-account gates, unassigned access, account-switch invalidation, mobile search and seven responsive page/review scenarios.                                                                                                                        |
| Accessibility                               | 14 new page/dialog Axe scans at 360, 390, 430, 768, 1024, 1280 and 1440px; keyboard cancel restores focus.                                                                                                                                                                                                                                                |
| Focused regressions                         | 12 pass: customer and legacy staff notification layouts/recovery, changed-role guard, workforce overview, technician update, forbidden routes, revoked access and mobile navigation.                                                                                                                                                                      |
| Backend boundary                            | Five units pass, including STAFF/ADMIN near-miss paths and unchanged legacy-account behavior.                                                                                                                                                                                                                                                             |
| Authenticated API                           | Six distinct scenarios have passing evidence across the initial five passing cases and a focused corrected receipt case on one new isolated synthetic account. Ownership/private DTOs, all templates, managed Admin, validation, immutable categories, CSRF/MFA, revoked/suspended identity, revoked assignments and legacy/customer separation verified. |
| Connected production browser/API/PostgreSQL | One owned read, three deliberate preference changes, three consent records/audits/receipts, original-request recovery without another change, later withdrawal preserved, altered-body 409 and immutable-category 422.                                                                                                                                    |
| Static/build                                | Frontend and backend type checks, focused frontend ESLint/backend Oxlint, production build and standalone preparation pass. Nine frontend runtime source hashes match the verified production snapshot.                                                                                                                                                   |
| Browser health                              | All four native final captures have no page errors or overflow; connected browser errors are empty.                                                                                                                                                                                                                                                       |

The first browser run had five test-expectation failures: four expected the desktop bell on mobile; one expected a disabled dialog after account invalidation had correctly removed the whole page. Corrected focused cases passed without runtime changes. The first API attempt stopped before fixture writes on an incorrect preservation-query sort key. The next run passed five scenarios and reached an incorrect assertion that withdrawal clears the original consent timestamp; implementation inspection confirmed retained history is intentional. The corrected receipt case passed separately using one fresh synthetic managed Admin, without replaying existing business writes.

Connected verification initially stopped when the harness reused a CSRF token rotated by the UI. A follow-up used the wrong method for token rotation, without another preference write. The final continuation obtained CSRF through the actual POST endpoint, restored only the captured test recovery intent into its new browser context, and recovered the original receipt. Initial read/operational/marketing changes were not repeated. This is resumed connected evidence, not a claim of an uninterrupted browser session. Reload/recovery behavior is also covered by the existing passing notification regressions.

## Evidence locations and data preservation

External artifacts under `C:/Users/PC/.codex/`:

- `workforce-notifications-baseline-*`, `workforce-notifications-final-*` and `workforce-notifications-real.png`.
- `workforce-notifications-e2e-results` (initial 16 passing cases), `workforce-notifications-e2e-focused-results` (corrected five) and `workforce-notifications-regression-results` (12).
- `workforce-notifications-api-tests.log`, `workforce-notifications-api-preservation.json`, `workforce-notifications-receipt-tests.log` and `workforce-notifications-receipt-preservation.json`.
- `workforce-notifications-real.json`, `workforce-notifications-real-before.json`, retained progress and `workforce-notifications-source-hashes.json`.

Database target verified before writes: `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, test environment. Runtime verified non-elevated, not the database/table owner and without table TRUNCATE privilege. The stopped isolated server was verified absent before restart; PostgreSQL completed its ordinary recovery and became ready. No database was reset, dropped, restored or recreated.

The initial API run preserved original row hashes across counts `[65,57,652,40,30,1,14,16,601]` for accounts, profiles, policies, branches, notifications, preferences, workforce access, assignments and audits. Connected verification preserved accounts, profiles, all 652 policies, workforce records, branches, other-account notifications/preferences and the existing financial tables. Financial tables were empty; this does not prove populated financial preservation. The focused receipt continuation also verified its original hashes. All owned temporary sessions were removed.

No application/shared database, existing grant, schema/migration, provider activation, backup/restore rehearsal, push or deployment was changed. Unchanged prior migration-replay/db-check evidence is reused; those commands were not rerun for this schema-free integration.

## Next work

Audit and redesign the managed-workforce overview at `/admin`, followed individually by its operational queues and detail pages. Application-wide role regression and deployed-environment acceptance remain open. Owner decision checklist consolidation remains proposed work; this notification integration does not implement it.
