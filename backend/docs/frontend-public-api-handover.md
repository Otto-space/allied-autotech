# Frontend handover: public branches and services

## Integration boundary

The first staging slice is read-only and unauthenticated. The frontend should call relative URLs on
the same HTTPS origin; Cloudflare routes `/api/v1/*` to the backend. Do not configure a second public
API origin for browser traffic.

```ts
const response = await fetch("/api/v1/public/services?limit=25");
const payload = await response.json();
```

The private OpenAPI 3.1 artifact is `docs/api/allied-autotech.openapi.json`. It contains no
credentials or sensitive examples. Share it only through the project's approved private channel.

## Available routes

| Method and path | Query parameters | Behavior |
| --- | --- | --- |
| `GET /api/v1/public/branches` | `limit` 1–100 (default 25), optional UUID `cursor`, optional `city`, optional `state` | Active branches only; city/state are case-insensitive exact filters |
| `GET /api/v1/public/branches/{branchId}` | UUID path parameter | One active branch or `404` |
| `GET /api/v1/public/services` | `limit` 1–100 (default 25), optional UUID `cursor`, optional `pricingType=FIXED|QUOTE_REQUIRED` | Active services only |
| `GET /api/v1/public/services/{serviceId}` | UUID path parameter | One active service or `404` |

List responses use stable ascending-ID cursor pagination. Send the returned `nextCursor` unchanged
to request the next page. Its absence means there is no next page.

```json
{
  "success": true,
  "message": "Services retrieved",
  "data": {
    "items": [
      {
        "id": "15d253b6-c4c2-4a15-98a7-43b8dd1738c4",
        "name": "Vehicle diagnostics",
        "slug": "vehicle-diagnostics",
        "description": "Electronic and mechanical diagnostic assessment.",
        "shortDescription": "Diagnostic assessment",
        "pricingType": "FIXED",
        "priceKobo": "2500000",
        "currency": "NGN",
        "durationMinutes": 90,
        "isActive": true,
        "version": 0,
        "createdAt": "2026-09-06T12:00:00.000Z",
        "updatedAt": "2026-09-06T12:00:00.000Z"
      }
    ],
    "nextCursor": "15d253b6-c4c2-4a15-98a7-43b8dd1738c4"
  },
  "meta": { "requestId": "5c4cc7a7-18bb-4f2f-b9bf-e6c7028b378b" }
}
```

Branch objects contain `id`, `code`, `name`, nullable public `phone` and `email`, `address`, `city`,
`state`, `country`, `timezone`, `isActive`, `createdAt`, and `updatedAt`.

Money is always a base-10 string in integer kobo. Never parse it through a floating-point number for
calculation; format `priceKobo / 100` with an integer/decimal money library. Dates are RFC 3339 UTC
strings. The current currency is `NGN`.

Validation and lookup failures use the same envelope:

```json
{
  "success": false,
  "message": "Request validation failed",
  "error": {
    "code": "VALIDATION_FAILED",
    "fields": { "query.limit": ["Too big: expected number to be <=100"] }
  },
  "meta": { "requestId": "ac5150be-a483-4768-915b-4a3b3c62fe76" }
}
```

Treat `error.code` as stable; wording may improve. Preserve and report `meta.requestId` when raising a
backend issue.

## Later authenticated flows

Authenticated browser calls use the host-only `HttpOnly` session cookie, not a bearer token. Send
`credentials: "same-origin"`. After login or session rotation, call `POST /api/v1/auth/csrf` and
send its returned value as `X-CSRF-Token` on every authenticated mutation. The backend also checks
the exact origin and `Sec-Fetch-Site`; the one-origin proxy design is therefore required.

Registration, login, bookings, checkout, vehicle sales, and payments exist in the backend contract
but are outside this first frontend slice. Do not mock them as staging-complete.

## Verification status

- Source routes and Zod/OpenAPI contracts: reviewed and contract-validated.
- Private OpenAPI artifact: generated from the release tree and checked for unresolved references.
- Fresh local PostgreSQL replay and API checks: all migrations, database tests, health/readiness,
  CORS, validation errors, and these four public routes were live-tested on an isolated `_ci`
  database.
- Container images, certificate-verified managed PostgreSQL, and deployed HTTPS staging: not
  live-tested by this document; those results must be recorded separately in release evidence.
