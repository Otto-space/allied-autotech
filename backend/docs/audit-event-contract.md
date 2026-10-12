# Audit event contract completeness

The API filter schema omitted the existing `LOGIN_FAILED` action and `BOOKING_SLOT` entity. The frontend audit parser also omitted `SERVICE_CATEGORY`. Because parsing validates every item in the returned page, a valid event with one of these values could prevent the entire page from rendering. Administrators also could not select all existing event types as filters.

## Implementation

The backend query schema now derives allowed actions and entities from the generated Prisma enums. The frontend options, parser and filter form include the missing values. A frontend contract test compares both complete option sets with the exported OpenAPI query enums, so additions cannot silently be omitted again.

The audit response now has an explicit OpenAPI schema: a bounded page of event IDs, optional actor/reference IDs, action/entity enums, timestamp, nullable selected before/after JSON objects and the actor's current role. The existing repository projection is preserved. Account credentials, IP addresses and user-agent fields are excluded. Before/after values may contain nested JSON and are not complete resource snapshots.

Admin/Super Admin access, verified privileged sessions, successful-read auditing, private/no-store caching, page limits, date-range checks and deterministic timestamp/ID pagination remain enforced. No new write route, migration or privilege is added. Booking-slot and service-category events do not gain invented detail links.

## Release

Deploy the matching backend before the frontend, then refresh already-open administrator pages. Old frontend bundles still reject these valid events. Existing request and response shapes remain compatible; the allowed filter values and generated response types are expanded. Target-environment acceptance remains pending.

## Verification

Verified locally on 12 October 2026:

- 17 backend cases passed: five API/PostgreSQL audit cases, five OpenAPI handover cases and seven existing API-boundary cases. The new cases enumerate every database action and entity, page tied timestamps, preserve nested JSON and check private-field exclusion, role/MFA access, invalid queries and successful-read auditing.
- Six frontend unit cases passed: three new contract-completeness cases and three existing audit-filter/date cases.
- Nine production-browser cases passed, including mixed event pages and exact filters for Admin and Super Admin, Staff denial, MFA redirect, failed-read recovery, pagination, nullable actors, supported links, literal JSON rendering, session invalidation, keyboard scrolling and accessibility at 320px and 1280px. The inspected screenshots and browser tests use controlled API responses; real persistence/authorization was verified separately through API/PostgreSQL tests.
- Backend type checks, lint, secret guard, formatting, OpenAPI validation (267 paths) and route coverage (316 operations) passed. Frontend scoped lint and an isolated production build, including TypeScript and standalone packaging, passed. Generated API types were refreshed. Tested audit components, filters and normalized parser source matched the workspace.

The existing isolated `allied_operations_paging_20261012_test` database was used. Its append-only synthetic audit evidence is retained; no application database or provider configuration was changed. The temporary preview was stopped after verification. No new migration is needed.

Entry points: `tests/integration/audit-enum-coverage.test.ts`, frontend `tests/unit/audit-contract.test.ts`, `tests/unit/audit-filters.test.ts` and `tests/e2e/audit.spec.ts`. This fixes contract completeness; it is not a full new visual acceptance gate for the audit page or a claim of deployed acceptance.

### Combined-suite verification follow-up

The enum checks are now parameterized into one request per action/entity, producing 62 audit cases instead of five grouped cases with the same coverage. Requests have explicit 10-second response and 15-second total deadlines, below the 30-second case timeout. During the combined run, a database connection timeout outlasted a grouped case and its remaining requests interfered with subsequent read-count assertions. The revised 62-case run passed on that same populated database. The original connection interruption's cause is not established; no production connection deadline or authorization rule was relaxed.
