# Milestone 102: workforce personal notifications

Status: accepted locally; see [milestone 102 acceptance](workforce-notifications.md). This file preserves the audit/specification written before runtime changes. Route: `/admin/notifications`.

## Audit and design before implementation

On 19 October, the existing production build was inspected at 430, 768, 1280 and 1440px. All four showed Access unavailable, no notification bell and no notification requests. Baseline images and JSON are outside the repository at `C:/Users/PC/.codex/workforce-notifications-baseline-*`. The old server handle was missing and port 3070 had no listener; the unchanged production build was restarted before capture.

Reuse the complete accepted [milestone 97 concept and specification](work-notifications-oct-concepts/spec.md). Both desktop and mobile/recovery concept images were inspected again before runtime changes. This is a targeted integration into that existing design, not another redesign. The builder skill permits reuse for a small UI fix within an existing design system. Preserve its heading, breadcrumb, inbox, preferences, dark preference header, filters, bordered controls, dialogs, responsive stack and accessible focus behavior. The only navigation additions are My notifications under workforce Settings and the existing Open notifications bell after verified current workforce access. The shell must render the existing page only for that exact route, just as it does account security.

## Contract and security boundary

Existing API: GET `/staff/notifications`; POST `/staff/notifications/:notificationId/read`; POST `/staff/notifications/read-all`; GET and PUT `/staff/notifications/preferences/current`. The boundary exception will match these paths exactly, with a UUID-shaped read target; no general notifications prefix. Existing mounted methods, strict Zod validation, authenticated active session, staff MFA, CSRF, account ownership, private/no-store middleware, preference version checks, immutable message categories and idempotency receipts remain authoritative. No additional DTO, route, schema or migration is needed.

Personal notifications belong to the active account, so they remain available without operational assignments. Revoked/expired assignments must still remove operational permissions. An invalid, denied, loading or different-account workforce snapshot must not mount the inbox. Suspension, session revocation and missing MFA remain server denials. Notification content does not grant permission to open its underlying business record. Marketing delivery remains disabled.

## Required verification

- All eight responsibility templates and managed STAFF/ADMIN navigation; no legacy operational links or APIs opened.
- Seven responsive widths, page and confirmation accessibility, keyboard cancel/focus, native concept comparison.
- Read markers, exact preference mutation, lost-response receipt recovery, identity changes, denied/loading workforce access, no assignments and mobile navigation.
- Backend boundary near-misses plus authenticated owned/foreign notification, CSRF/MFA/revocation and preference-replay coverage on an isolated test database.
- Focused existing workforce, legacy staff and customer regression; type/lint/build checks and connected verification before acceptance.

No production activation, application-database write, migration, grant change or deployment is part of this integration.
