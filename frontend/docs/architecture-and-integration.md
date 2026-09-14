# Frontend architecture and integration

This describes the current implementation. It does not certify completion of the full brief; use the [coverage ledger](api-coverage.md), [validation record](validation-progress.md) and [release blockers](release-blockers.md) together.

## Application boundaries

- `app/` contains Next.js App Router pages. Public service, part and vehicle detail pages fetch public API projections on the server and pass initial data into interactive components. The root layout renders dynamically to support per-request CSP nonces.
- `app/components/` contains public, account and workshop interfaces. Customer pages live under `/dashboard`; staff and administrators share `/admin` with role-filtered navigation. Backend authorization remains authoritative for every request.
- `lib/api/generated.d.ts` is generated from the sibling backend OpenAPI artifact. `contracts.ts` extracts request-body types. Separate runtime Zod schemas validate the actual response projections because the OpenAPI response definitions are incomplete.
- `lib/api/client.ts` owns browser requests, error normalization, request timeouts, in-memory CSRF state and session generation. `use-resource.ts` owns component-local reads, cancellation, stale responses and explicit refresh/error states. No shared cache stores customer records.
- `lib/forms/` contains reusable validated form values. `lib/format/` converts integer kobo to display amounts and formats dates in Africa/Lagos. Public business details and approved-media rules live in their dedicated library modules.

## Request and session flow

The browser uses same-origin `/api/v1` URLs. Next.js rewrites them to the validated server-only `BACKEND_ORIGIN`. The browser never reads the HttpOnly session cookie or handles a bearer token. Public server-side detail requests use public endpoints without user credentials.

Cookie-authenticated mutations obtain a CSRF token through the existing backend endpoint. Concurrent CSRF reads share one in-flight request. Session changes invalidate that token and advance a generation counter, so responses from an earlier account cannot populate the current account's request state. A cross-tab channel broadcasts invalidation only; it does not contain account records or credentials.

`DashboardShell` verifies the session, role and MFA requirement before mounting account content. It removes private content on session invalidation and rechecks on returning to a visible tab. Those UI guards supplement the backend's ownership, role and branch checks; they are not a substitute for them.

## Consequential changes

The API client does not automatically replay mutations. Endpoints that provide an idempotency contract receive a dedicated key; uncertain customer checkout/booking retries preserve their original payload and key. Payment return navigation is not evidence of successful payment: the payment screen reads and verifies backend state, and pending states prevent initiating another charge.

Workshop changes use the endpoint's expected version or quotation revision and a review dialog. Catalogue-part prices are omitted from quote/work-order requests so the server prices those parts. Labour, fee and tax entries convert decimal NGN strings to integer kobo using `BigInt`. Draft replacement follows the backend's creation of a new draft and voiding of the old draft.

For quotation, line-item and slot creation without idempotency support, an uncertain response disables the submitted form and prompts review of refreshed records. No automatic retry is issued. This protection does not eliminate the need to inspect backend state after an uncertain network outcome.

Inventory movements, reservations and releases preserve one payload/key per reviewed operation. An unknown outcome pauses new stock mutations and offers an explicit retry of that same request; refreshed server balances remain authoritative. Cancelled or rejected reviews preserve draft input. Confirmed changes reset forms and refresh balances, history and reservations. Reorder updates use the current inventory version. A stock sale does not create an order, invoice or payment. Reservation expiry validation can reject a late retry before idempotency replay; this backend recovery limitation is tracked in the release blockers.

## Rendering and security headers

`proxy.ts` supplies a per-request CSP nonce and private/no-store headers for account and payment routes. Script and production style elements require the nonce. Inline style attributes remain allowed for Next/Image layout. Approved image hosts are validated before entering the CSP; arbitrary API-provided image URLs are not accepted.

`SITE_INDEXING` defaults to disabled. This is a search-index directive, not access control. Production domain-dependent SEO work and deployment-level HTTPS/cookie checks remain unfinished.

## Local packaging and evidence

Development and production compilation use Webpack after a reproduced Turbopack runtime panic. `npm run build` produces standalone output; the postbuild script copies static assets and approved public files. The preserved generated workshop image is excluded from that artifact. `npm start` runs the standalone Node server.

Unit tests cover client isolation, money and media boundaries. Browser fixtures verify specific rendered workflows, payloads, keyboard behavior, responsive layouts and accessibility. The separately gated loopback API harness exercises real customer cookies, profile, booking and checkout against a disposable test database. Its fixture endpoint is outside backend application source and guarded against non-test targets. Current staff browser tests use intercepted responses; they do not prove real staff MFA, database authorization or provider behavior.

See [local development and staging prerequisites](local-development.md) for commands and environment boundaries. No deployment has been performed or approved by these checks.
