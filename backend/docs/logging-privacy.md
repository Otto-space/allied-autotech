# Application log privacy

SEC-033, recorded 13 October 2026. Local acceptance is complete; deployment remains outstanding.

## Confirmed gap

The HTTP error boundary passed raw exceptions to Pino's default error serializer. Field redaction did not remove secrets embedded in free-text error messages, stacks or nested causes. Malformed JSON errors also retained the original request body, and Prisma errors could include invocation text and metadata. The HTTP request serializer logged raw URL paths, including parameter values and unmatched paths.

All 11 initial emitted-log regressions failed against the original configuration (`%TEMP%/allied-log-privacy-baseline.json`). The tests use synthetic markers only; this establishes exposure in the old code, not evidence that a particular production credential was leaked.

## Implementation

The HTTP error handler projects exceptions through `safeErrorAttributes`. The application logger and Pino HTTP logger use the same serializer, covering direct calls, child loggers and errors attached to a response. The logger also supplies a fixed message when an error is logged without one. This closes Pino's separate implicit-message path, which copies the original error message before error serialization. The [Pino API](https://github.com/pinojs/pino/blob/main/docs/api.md) documents serializers and log hooks; the installed [Pino HTTP implementation](https://github.com/pinojs/pino-http) supports custom completion objects and unwrapped serializers.

Error output contains recognized names, application/transport codes or bounded Prisma `Pdddd` codes, plus retryability where applicable. Messages, stacks, causes, arbitrary metadata, request/response attachments and error bodies are omitted. Unknown names and codes cannot pass through merely because they resemble a token. Getter failures return a fixed fallback instead of breaking logging. Sanitized projections can safely pass through the serializer again. Existing P2021/P2022 migration-recovery guidance remains available without database names, SQL or credentials.

HTTP completion logs retain request ID, method, response status and duration. They replace raw `req.path` with the matched Express `route` template; URL parameter values and query strings are excluded. The field is the matched router's local route pattern, not a reconstructed full URL. Requests rejected before route resolution or without a recognized string route pattern use `UNRESOLVED`. Existing structured-field redaction remains enabled. The middleware does not log request/response headers or bodies.

Application-authored messages and identifiers remain deliberate log fields; developers must continue using fixed messages rather than interpolating private data. The checked API/server/worker call sites use fixed event messages and safe attributes. This is not a sanitizer for arbitrary application code that explicitly writes secrets as unrelated message text.

## Verification

The expanded log suite contains 16 cases inspecting actual serialized JSON output. It covers structured, bare, implicit, undefined-message and child-logger errors; Prisma invocation text; malformed request JSON; arbitrary exception objects; matched and unmatched paths; response-attached errors; token-shaped names/codes; a real Paystack JSON parsing failure; cyclic aggregate causes; throwing getters; and existing field redaction. HTTP tests also assert safe client responses and preserved diagnostic fields.

The regression passed **135 cases across 12 files, with no failures or skips** (`%TEMP%/allied-log-privacy-regression.json`). Coverage includes worker resilience, HTTP foundation, database error mapping and an actual refused database connection, identity boundaries/security and database flow, provider transport bounds, notification retries and signed dispute processing. Database integration cases used isolated `allied_paystack_dispute_contract_20261013_test`.

Typecheck, lint, backend build, affected formatting, secret scanning, OpenAPI validation (266 paths), route coverage (315 operations plus four infrastructure routes) and diff checks passed. Public responses, database schema and rendered frontend behavior are unchanged, so browser tests and migration replay were not repeated for this repair.

## Rollout

Deploy matching API, identity-worker and general-worker builds. Update any log queries that depend on raw `req.path` or error `message`/`stack`: use `route`, request ID, safe error name/code, retryability and existing worker/event attributes. New provider error codes should be reviewed and added to the allowlist with a regression test when needed.

Historical logs were not inspected or modified. This repair prevents the reproduced output paths in new logs after rollout; it does not certify historical log contents or complete the broader application/deployment audit.
