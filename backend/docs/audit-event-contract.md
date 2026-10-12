# Audit event contract completeness

The API filter schema omitted the existing `LOGIN_FAILED` action and `BOOKING_SLOT` entity. The frontend audit parser also omitted `SERVICE_CATEGORY`. Because parsing validates every item in the returned page, a valid event with one of these values could prevent the entire page from rendering. Administrators also could not select all existing event types as filters.

## Implementation

The backend query schema now derives allowed actions and entities from the generated Prisma enums. The frontend options, parser and filter form include the missing values. A frontend contract test compares both complete option sets with the exported OpenAPI query enums, so additions cannot silently be omitted again.

The audit response now has an explicit OpenAPI schema: a bounded page of event IDs, optional actor/reference IDs, action/entity enums, timestamp, nullable selected before/after JSON objects and the actor's current role. The existing repository projection is preserved. Account credentials, IP addresses and user-agent fields are excluded. Before/after values may contain nested JSON and are not complete resource snapshots.

Admin/Super Admin access, verified privileged sessions, successful-read auditing, private/no-store caching, page limits, date-range checks and deterministic timestamp/ID pagination remain enforced. No new write route, migration or privilege is added. Booking-slot and service-category events do not gain invented detail links.

## Release

Deploy the matching backend before the frontend, then refresh already-open administrator pages. Old frontend bundles still reject these valid events. Existing request and response shapes remain compatible; the allowed filter values and generated response types are expanded. Target-environment acceptance remains pending.

## Verification

Local evidence is being finalized. API tests enumerate every database action and entity, page tied timestamps and check private-field exclusion, access control and read auditing. Frontend tests compare the complete enum sets with OpenAPI and exercise mixed pages and exact filters for both administrator roles. Tests retain append-only synthetic audit evidence in the isolated test database.
