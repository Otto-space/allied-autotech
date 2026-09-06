# Phase 7 Security and Readiness Review

Review date: 2026-09-06

## Decision

Phase 7 is complete against its stated acceptance criteria. The application and a disposable PostgreSQL database passed validation, full migration replay, strict TypeScript compilation, linting, formatting, builds, API/unit/integration tests, and the Phase 7 data preflight. No critical or high-confidence exploitable application vulnerability was found in the implemented Phase 1–7 surfaces.

The review follows OWASP secure-design themes: deny by default, validate every trust boundary, minimize data exposure, preserve transaction integrity, authenticate every privileged action, and fail without leaking internals. This is a code review and automated verification result, not a substitute for an independent penetration test against the deployed staging topology.

## Verified controls

- The API uses an exact credentialed CORS allowlist, Helmet, bounded JSON bodies, rate limits, explicit proxy hops, and an isolated 256 KB raw webhook parser (`src/app.ts:44`, `src/app.ts:65`, `src/app.ts:70`, `src/app.ts:106`).
- Authentication uses opaque hashed server-side sessions, `HttpOnly` host-only cookies, synchronizer CSRF tokens, origin/fetch-metadata checks, account throttling, and mandatory MFA assurance for privileged roles.
- All implemented route inputs use Zod allowlist schemas. Customer ownership, staff branch scope, and administrative roles fail closed before database mutations.
- Phase 7 private assets use generated keys, short expiry, MIME/size/checksum/signature checks, and authorization before issuing access.
- Monetary values are integer kobo. Sensitive workflows use PostgreSQL transactions, row/advisory locks, optimistic versions, idempotency, audit logs, and database constraints/triggers.
- Paystack credentials are production-required server configuration (`src/config/env.ts:128`, `src/config/env.ts:217`). The provider adapter uses a fixed HTTPS origin, a bounded timeout/response, disabled redirects, and allowlisted response parsing.
- Paystack signatures are compared in constant time over the exact raw request bytes (`src/providers/payments/paystack-webhook.ts:29`). Verified webhook identity is immutable at the database layer (`prisma/migrations/20260906100000_phase_8_payment_security/migration.sql:67`).
- Manual-payment and refund approval are default-deny, MFA-protected, and require a different approver (`src/modules/payments/payments.policy.ts:10` plus database constraints).

## Secret exposure result

No secret leak was found in tracked files, staged changes, the checked Git patch history, or environment-file tracking:

- `backend/.env` and frontend `.env*` are ignored.
- The only tracked environment file is `backend/.env.example`; its credential fields are empty or explicit non-secret development placeholders.
- The repository secret guard passed all non-ignored files.
- History scans found no private keys, AWS keys, GitHub tokens, Resend keys, payment-provider secrets, or credential-bearing URLs.
- Gitleaks was not installed, so the repository guard and direct Git-history pattern scans were used. CI should add a second independent scanner before staging.

## Residual findings

### SEC-007 — Frontend CSP is not yet enforced

- Severity: Medium before the frontend accepts untrusted content; Low for the current starter page.
- Evidence: `frontend/next.config.ts` supplies frame, MIME, referrer, and permissions headers (`frontend/next.config.ts:20`) but no application CSP.
- Risk: A future injection defect would have less browser-level containment.
- Required action: design a nonce-based Next.js CSP, deploy it in report-only mode in staging, resolve violations, then enforce it before public launch. Do not add a guessed policy that breaks framework hydration.

### SEC-008 — Deployment trust boundary is not yet exercised

- Severity: Medium before staging.
- Evidence: proxy trust is explicit and safe by default (`src/app.ts:44`), but no deployed Cloudflare/DigitalOcean hop topology exists in the repository.
- Risk: an incorrect forwarded-header chain can affect client IP rate limiting, secure redirects, and security telemetry.
- Required action: test the exact Cloudflare-to-origin path in staging; keep the origin private, restrict it to the tunnel/load balancer, and set `TRUST_PROXY_HOPS` only to the measured topology.

### SEC-009 — API documentation needs deployment access control

- Severity: Low.
- Evidence: production API startup rejects `API_DOCS_ENABLED=true`. Local documentation has
  no-store/CSP controls, and a private generated JSON artifact is available for handover.
- Risk: publishing an interactive UI increases endpoint discovery and requires relaxed inline
  directives.
- Required action: keep hosted documentation disabled in staging/production and share the static
  contract only through an approved private channel.

### SEC-010 — Prisma CLI advisories remain

- Severity: Low application reachability; npm reports High.
- Evidence: the same-major `mysql2` override is `3.24.3` and removes both MySQL findings. Three npm
  findings remain because Prisma 7.10 pins vulnerable `deepmerge-ts` 7.1.5 in its CLI/configuration
  path. A clean production-only install confirms that `prisma`, `deepmerge-ts`, and `mysql2` are all
  absent from the API/worker runtime dependency tree.
- Required action: track a supported Prisma release that uses `deepmerge-ts` 8 or later. Do not
  force the incompatible Prisma downgrade or an untested transitive major override. Keep migration
  images private, short-lived, and restricted to trusted static configuration.

## OWASP readiness conclusion

The implemented code follows the applicable OWASP API Security and secure-coding patterns for authentication, authorization, property-level projections, resource consumption, business-flow controls, SSRF-resistant provider access, security configuration, inventory documentation, and safe error handling. Staging must still add dynamic authorization/abuse testing, TLS/edge validation, observability validation, backup restoration, and an independent penetration test before production approval.
