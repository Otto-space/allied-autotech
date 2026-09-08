****# Security Best-Practices Review

## Executive summary

The repository contains a Next.js frontend and an Express/Prisma backend. No secrets are tracked or staged, and no credential-shaped values were found in the working tree or Git history. The backend now includes secure identity, customer ownership, privileged provisioning, branch-aware administration, strict validation, CSRF, MFA, and append-only audit controls.

One dependency advisory remains in Prisma's development CLI dependency tree. It is not reachable through the running API, and npm's proposed remediation is an incompatible Prisma 7 to Prisma 6 downgrade. A Content Security Policy for Next.js should be added when the application's script/image requirements are known; introducing an untested policy now could break framework hydration.

## Resolved findings

### SEC-001 — Credentialed CORS configuration

- Rule ID: EXPRESS-CORS-001
- Severity: High
- Location: `backend/src/server.ts`, environment validation and CORS middleware, lines 13–31 and 58–72
- Evidence: `FRONTEND_URL` is now required, parsed as one or more valid URLs, normalized to exact origins, and compared through a `Set`. Untrusted browser origins receive HTTP 403.
- Impact: The previous **single** optional environment value could create broken or unintended credentialed cross-origin behavior.
- Fix: Exact origin allowlisting, explicit methods/headers, controlled preflight caching, and fail-fast environment validation.
- Mitigation: Keep production `FRONTEND_URL` limited to exact HTTPS application origins.
- False-positive notes: Requests without an `Origin` header remain allowed because non-browser clients and same-origin traffic commonly omit it; authentication and authorization must still protect private routes.

### SEC-002 — Unbounded requests and basic abuse exposure

- Rule ID: EXPRESS-BODY-001 / EXPRESS-RATE-001 / EXPRESS-TIMEOUT-001
- Severity: Medium
- Location: `backend/src/server.ts`, lines 49–56, 74, and 102–108
- Evidence: The API now limits JSON bodies to 100 KB, throttles each client to 300 requests per 15 minutes, and configures request/header/keep-alive timeouts.
- Impact: Large or slow requests and inexpensive request floods could consume memory, sockets, or application capacity.
- Fix: Added explicit parser limits, standards-based rate-limit headers, and bounded server timeouts.
- Mitigation: Add stricter per-route limits to future login, password-reset, payment, and enquiry endpoints; use a shared rate-limit store when running multiple API instances.
- False-positive notes: Infrastructure-level throttling was not visible in this repository.

### SEC-003 — Server fingerprinting and uncontrolled errors

- Rule ID: EXPRESS-FINGERPRINT-001 / EXPRESS-ERROR-001
- Severity: Medium
- Location: `backend/src/server.ts`, lines 42–48 and 83–100
- Evidence: Express fingerprinting is disabled, Helmet is enabled, and custom JSON 404/error handlers prevent stack traces from reaching clients.
- Impact: Default framework responses disclose implementation details and can expose internal exception information.
- Fix: Disabled `X-Powered-By`; added controlled 404, CORS, and generic error responses.
- Mitigation: Send structured server logs to a protected logging service in production and never log request credentials or tokens.
- False-positive notes: Development responses are also generic; full errors remain server-side only.

### SEC-004 — Missing frontend baseline headers

- Rule ID: NEXT-HEADERS-001 / REACT-HEADERS-001
- Severity: Medium
- Location: `frontend/next.config.ts`, lines 3–20
- Evidence: Next.js fingerprinting is disabled and all routes now receive MIME-sniffing, clickjacking, referrer, and browser-feature restrictions.
- Impact: Without these headers, browsers provide weaker protection against framing, MIME confusion, referrer leakage, and unnecessary powerful features.
- Fix: Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` globally.
- Mitigation: Preserve or strengthen these headers at the deployment edge.
- False-positive notes: A deployment platform may already set some headers; duplicate compatible values should be consolidated at deployment time.

## Residual findings

### SEC-005 — Prisma CLI transitive dependency advisories

- Rule ID: JS-SUPPLY-001
- Severity: Low in this repository (npm rating: High)
- Location: `backend/package-lock.json`; dependency path `prisma@7.10.0 > @prisma/config@7.10.0 > deepmerge-ts@7.1.5`
- Evidence: `npm audit --omit=dev` reports four high-rated dependency-chain findings involving `deepmerge-ts`, `mysql2`, `@prisma/config`, and `prisma`. Prisma runs only in controlled application/database tooling, and the checked-in config exports a fixed plain object rather than attacker-controlled recursive data.
- Impact: The reported issues concern recursive configuration merging and MySQL protocol behavior. This application uses PostgreSQL and does not expose Prisma configuration or MySQL connections to untrusted callers.
- Fix: Upgrade Prisma when it adopts `deepmerge-ts >= 8.0.0`. Do not use `npm audit fix --force`; npm currently proposes an incompatible downgrade to Prisma 6.12.0.
- Mitigation: Run Prisma only in trusted development/CI environments and do not merge untrusted objects into Prisma configuration.
- False-positive notes: The advisory's generic severity overstates this application's runtime exposure; it remains a real development-tool dependency issue.

### SEC-006 — Next.js Content Security Policy not yet enforced

- Rule ID: NEXT-CSP-001 / REACT-HEADERS-001
- Severity: Low for the current static starter page; reassess before accepting user content or third-party scripts
- Location: `frontend/next.config.ts`, headers configuration
- Evidence: No `Content-Security-Policy` response header is configured.
- Impact: A future injection bug would have fewer browser-level restrictions on script execution and resource loading.
- Fix: Introduce a nonce- or hash-based CSP once the app's runtime rendering, image, API, analytics, and payment domains are defined and test it in report-only mode first.
- Mitigation: Continue avoiding raw HTML, dynamic script injection, untrusted URL navigation, and browser storage for authentication tokens.
- False-positive notes: No `dangerouslySetInnerHTML`, DOM injection, eval, dynamic script loading, or user-generated rendering exists in the current frontend.

## Verified controls

- `backend/.env` is ignored and is not tracked, staged, or present in any of the 11 commits reviewed on 2026-09-04.
- `.env.example` contains only empty values, non-secret configuration, and explicit placeholders.
- Automated `npm run check:secrets` scanning now blocks environment files, private keys, common provider tokens, JWTs, credential-bearing URLs, and literal sensitive example values from non-ignored repository files.
- Database credentials remain environment-sourced and are URL-encoded in `backend/prisma.config.ts`.
- Passwords and authentication/reset/session tokens are modeled as hashes rather than plaintext values.
- UUIDs are used for public database identifiers.
- PostgreSQL constraints enforce important monetary, inventory, rating, and lifecycle invariants.
- Backend audit findings are limited to the documented Prisma toolchain dependency chain; no forced incompatible downgrade was applied.
- Prisma validation, backend TypeScript checks, and direct API behavior checks pass.
