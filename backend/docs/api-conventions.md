# API conventions

All public HTTP contracts live under `/api/v1`. Route surfaces are separated into `/public`,
`/auth`, `/customers`, `/staff`, `/admin`, webhook, and internal-worker boundaries.

Responses contain `success`, `message`, optional `data`, and `meta.requestId`. Failures add a stable
`error.code` and may include field-level validation errors; they never return stack traces, rejected
credentials, provider payloads, or persistence details.

Browser sessions use the host-only opaque session cookie. The frontend must call `POST /auth/csrf`
after login or session rotation and submit the returned value in `X-CSRF-Token` for each authenticated
mutation. Verification and reset values belong in POST bodies. Frontend email links keep tokens in a
URL fragment so browsers do not send them to proxies, access logs, or referrers.

All input objects are strict allowlists. Unknown fields are rejected, including attempted role or
ownership assignment. Sensitive endpoints have route-specific rate limits in addition to the global
limit and PostgreSQL-backed authentication throttles.

Phase 3 adds cursor-paginated branch, staff, and customer-vehicle collections. Limits are bounded to
100 and cursors must identify a resource visible inside the caller's authorization scope. Staff and
administrator registration is invitation-only. Invitation tokens are submitted in POST bodies and
kept in frontend URL fragments.
