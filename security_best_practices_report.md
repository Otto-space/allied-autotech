# Security Best-Practices Review

Review date: 2026-09-10

## Executive summary

The backend is designed around an Express 5, Prisma 7, and PostgreSQL trust boundary. The reviewed release uses opaque, server-side sessions rather than browser-stored bearer tokens; synchronizer CSRF protection; default-deny role, ownership, and branch policies; mandatory MFA assurance for privileged access; strict Zod input contracts; transactional business operations; and redacted structured logging.

No credential or private-key file is tracked, and both the current-tree and Git-history secret guards pass. The new customer-review implementation supports separately rated overall-business and verified-purchase product reviews. Product eligibility, one-review-per-customer/product, moderation, and immutability are enforced in both application code and PostgreSQL. The customer-care messaging surface enforces thread ownership or staff scope, hides internal messages from customers, disables private-response caching, and uses bounded cursor polling.

No unresolved critical or high-severity application-code vulnerability was found in this pass. One npm-rated high transitive advisory remains in the Prisma CLI configuration toolchain. It is documented below because npm currently offers only an incompatible forced downgrade, not a safe upgrade. Staging still requires browser, Cloudflare/Vercel proxy, database-TLS, object-storage, and provider validation with real infrastructure.

OAuth, Google sign-in, and JWT access tokens were not added. They are not needed for the current browser application and would add token, account-linking, redirect, and key-rotation attack surfaces without replacing the existing session and CSRF requirements.

## Verified security controls

- `backend/.env` is ignored and untracked. `.env.example` contains placeholders and documented non-secret settings only.
- `npm run check:secrets` and `npm run check:secrets:history` scan for forbidden environment files, private keys, credential-bearing URLs, provider credentials, JWTs, and credential-shaped literals.
- The API disables Express fingerprinting, uses explicit trusted-proxy hop counts, Helmet, exact credentialed CORS allowlisting, bounded JSON parsing, isolated raw Paystack webhook bytes, and private/no-store API caching (`backend/src/app.ts`).
- Session cookies are `HttpOnly`, `SameSite=Lax`, path `/`, have no `Domain`, and are `Secure` in production (`backend/src/common/security/cookies.ts`). Session and CSRF values are stored only as purpose-separated HMAC hashes.
- Authenticated mutations require a session-bound CSRF header plus trusted Origin and fetch-metadata validation (`backend/src/common/middleware/csrf.ts`).
- Passwords use Argon2id. Password, token, cookie, authorization, MFA, payment, personal-data, and storage-key paths are redacted from logs.
- Privileged access requires an active user, an unexpired/revocable opaque session, role/branch policy approval, and completed MFA assurance.
- Paystack webhooks are signature-verified over their exact raw bytes before trusted parsing. Event deduplication, amount/currency/reference validation, locking, immutable ledger entries, anomalies, and four-eyes refund/manual-payment decisions protect settlement.
- Provider adapters use fixed or allowlisted HTTPS origins, request timeouts, bounded responses, redacted errors, and retry classification. Staging enforces Paystack test mode; live keys require explicit production enablement.
- Private vehicle/payment assets use validated content metadata, generated storage keys, authorization-gated short-lived access, and never return underlying object keys.
- PostgreSQL constraints and triggers protect non-negative inventory, integer-kobo totals, lifecycle transitions, append-only financial/inventory/audit history, active reservation uniqueness, review eligibility, and immutable approved review targets.

## Review and customer-care controls

### SEC-007 — Product-review eligibility and immutability

- Status: Resolved
- Severity before mitigation: High
- Evidence: `backend/src/modules/support/support.schemas.ts`, `backend/src/modules/support/support.service.ts`, and `backend/prisma/migrations/20260910101000_product_reviews/migration.sql`.
- Resolution: A product review requires a 1–5 rating, the target product, and a completed order item owned by the authenticated customer. PostgreSQL independently verifies the same relationship. A partial unique index enforces one product review per customer/product, and target/rating/content fields are immutable after creation. Only approved reviews are public, and their projection excludes customer identity.

### SEC-008 — Overall-experience review boundary

- Status: Resolved
- Severity before mitigation: Medium
- Evidence: `backend/src/modules/support/support.schemas.ts` and the review moderation service.
- Resolution: Overall experience uses the distinct `BUSINESS` review target and requires a 1–5 rating. It follows the same customer authentication, moderation, public projection, audit, and immutable-content controls as other reviews.

### SEC-009 — Customer-care message isolation

- Status: Resolved
- Severity before mitigation: High
- Evidence: `backend/src/modules/support/support.routes.ts`, `support.service.ts`, `support.repository.ts`, and `support.controller.ts`.
- Resolution: Customers can read or append only their own enquiry/complaint threads. Staff access is role- and branch-scoped. Internal messages are removed from all customer queries. Cursors must belong to the authorized thread, writes to closed threads fail, bodies and page sizes are bounded, mutations require CSRF, and message responses use `private, no-store`. Assigned staff/customer notifications use the transactional outbox.

### SEC-010 — Cross-instance real-time delivery decision

- Status: Safely bounded
- Severity: Informational
- Resolution: The initial chat experience uses five-second bounded cursor polling. It works through Vercel forwarding and multiple App Platform instances without sticky sessions or an in-memory connection registry. WebSockets or server-sent events should be introduced only with a shared event backbone, authenticated connection revalidation, origin enforcement, connection/message quotas, and confirmed proxy support.

## Residual findings and deployment validation

### SEC-011 — Prisma CLI transitive dependency advisory

- Status: Accepted temporarily; upgrade watch required
- npm severity: High; assessed runtime exposure: Low when runtime images exclude the Prisma CLI
- Dependency path: `prisma@7.10.0 > @prisma/config@7.10.0 > deepmerge-ts@7.x`
- Advisory: `deepmerge-ts` can exhaust the stack while merging attacker-controlled recursive object graphs. The application does not accept untrusted Prisma configuration objects, and Prisma CLI execution is limited to controlled development, CI, and migration jobs.
- Action: Upgrade Prisma when a compatible stable release resolves `deepmerge-ts < 8`. Do not run `npm audit fix --force`; the current proposed remediation is an incompatible Prisma 6 downgrade. Keep the migration image private and short-lived, and verify that API/worker runtime images omit the CLI.

### SEC-012 — Staging edge and browser validation

- Status: Requires deployed infrastructure
- Severity: Medium until validated
- Required checks: exact Cloudflare/Vercel/App Platform proxy topology and hop count; HTTPS redirect and forwarded-protocol behavior; PostgreSQL `verify-full` CA validation; private Spaces permissions and signed-access expiry; Paystack test-mode webhook delivery; cookie `Secure`/`SameSite` behavior; CSRF Origin/fetch-metadata rejection; cache bypass for sessions and private API responses; hosted Swagger disabled; and a nonce-based frontend CSP tested in report-only mode before enforcement.

## Verification record

The release gate includes migration replay from an empty PostgreSQL database, Prisma validation/status, strict TypeScript compilation, lint and formatting checks, OpenAPI generation/validation, unit/API/integration/security tests, current-tree and history secret scans, `git diff --check`, production builds, and container smoke tests. Results and any environment-dependent exclusions are recorded in `backend/docs/backend-completion-staging-readiness.md`.
