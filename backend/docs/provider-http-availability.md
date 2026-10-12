# Provider HTTP availability and response limits

SEC-032, recorded 13 October 2026. Locally verified; deployed provider acceptance remains open.

## Finding and repair

Paystack and Monnify checked response size only after `arrayBuffer()` had consumed the complete body. A chunked or compressed provider response could therefore exceed the configured memory budget before rejection. The fetch abort signal also did not independently bound a transport that ignored cancellation. Resend and Termii awaited body cancellation after receiving headers, allowing a broken cancellation promise to hold a delivery worker even after acceptance or a definitive rejection.

The shared [transport guard](../src/providers/provider-http.ts) gives each HTTP request one wall-clock deadline covering headers, body consumption and provider parsing. It races that deadline and aborts the transport. Late response headers are discarded without running the provider parser. Cleanup requests cancellation without awaiting its promise. Timers and abort listeners are removed after completion.

Payment bodies are read as byte chunks. Declared oversized bodies are rejected immediately, while actual decoded bytes are counted before retaining each chunk. Missing or misleading length headers do not bypass the limit, and compressed/multibyte bodies are measured in bytes. At most the configured byte budget is retained in the chunk list; concatenation and JSON decoding require additional bounded copies. This is not a claim of zero transport-internal buffering.

The implementation uses the documented [Node Web Streams reader and cancellation APIs](https://nodejs.org/api/webstreams.html) and [AbortController](https://nodejs.org/api/globals.html#class-abortcontroller). Cancellation returns a promise, so worker completion does not depend on that promise settling. The independent deadline also bounds the caller when an injected transport ignores abort; it cannot force arbitrary third-party JavaScript to release its own resources. Real Node fetch connection closure is tested separately.

All four adapters use the guard. Paystack retains its lossless identifier parser. Monnify authentication and API requests each retain their existing request budget and token cache behavior; Monnify remains disabled in application configuration. Resend and Termii still rely on HTTP acceptance and discard unused bodies. Existing retryable HTTP classifications, fixed payment/email origins, configured Termii origin, redirect refusal, authorization headers, payloads and Resend idempotency keys are preserved. No automatic request replay was added.

## Verification

All eight baseline cases failed against the old implementation (`%TEMP%/allied-provider-http-baseline.json`): four transports ignoring abort, two payment streams exceeding the limit without ending, and two messaging cancellation promises that never settled.

The completed focused suites contain 36 cases. They cover late headers, hanging cancellation during reads, deadline cleanup, exact byte limits, real HTTP chunked/gzip/multibyte overflow, declared overflow, absent headers, stalled bodies, redirect refusal, accepted/rejected/rate-limited/unavailable messaging responses, connection closure and exact large payment identifiers. Real HTTP tests use a loopback server and synthetic credentials; no external provider is contacted.

The broader regression passed **154 tests across 14 files with no failures or skips** (`%TEMP%/allied-provider-http-regression.json`). It includes payment initialization/verification, Monnify's isolated compatibility tests, signed dispute HTTP ingestion, refund dispatch and polling, notification retry authorization/worker behavior, provider identities, security rules and API boundaries. Database tests used existing isolated `allied_paystack_dispute_contract_20261013_test`.

Typecheck, lint, backend build, affected formatting, secret scanning, OpenAPI validation (266 paths), route coverage (315 operations and four infrastructure routes), and diff checks passed. This change adds no database schema, environment variables, API response fields or rendered frontend behavior, so migration replay and browser tests were not repeated for this repair.

## Rollout and remaining scope

Deploy matching API, identity-worker and general-worker builds so all provider consumers use the guard. Keep the existing configured timeout and response-size limits. Confirm test-mode provider connectivity and delivery in staging before production acceptance. No live provider account, application database, activation flag or deployment was changed.

This addresses HTTP availability bounds, not the full backend completion audit. Existing financial, storage, deployment and owner-approval gates remain in their respective acceptance records.
