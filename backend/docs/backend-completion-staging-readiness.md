> Historical phase document. Booking-deposit, provider-activation and readiness claims below are superseded by the signed 22 September owner decisions. Use [the current implementation matrix](owner-implementation-matrix.md) and [staging runbook](owner-staging-runbook.md).

# Backend completion and staging readiness

## Verdict

**Ready to deploy to staging after the listed infrastructure inputs are supplied.**

The application, identity worker, general worker, and migration job are implemented as separate
runtime components. No remote deployment, provider call, live payment, or managed-cloud restore
test is claimed here. Delivery, webhook, browser-cookie, proxy, storage, and TLS behavior still
require verification in the real staging environment.

## Implemented and locally verified

- Express 5 security foundation: strict Zod boundaries, stable error envelopes, request IDs,
  redacted structured logs, exact CORS origins, bounded bodies, rate limits, explicit proxy trust,
  Helmet headers, safe 404/error handling, liveness, readiness, and graceful shutdown.
- PostgreSQL-backed identity: Argon2id passwords, hashed opaque sessions, synchronizer CSRF,
  verification and recovery, lockout/throttling, TOTP, WebAuthn, recovery codes, session rotation,
  privileged MFA, invitations, and guarded first-super-admin bootstrap.
- Customer, organization, catalogue, inventory, service-operation, order, promotion, billing,
  vehicle, vehicle-sale, and payment route surfaces with default-deny role/ownership policies.
- Transactional inventory reservations, deterministic locking, integer-kobo server pricing,
  immutable snapshots, lifecycle checks, idempotency, audit history, and expiry workers.
- Paystack test/live and Monnify sandbox/live safeguards independent of `NODE_ENV`, raw-byte
  webhook verification, authoritative provider verification, deduplication, reconciliation,
  four-eyes manual-payment/refund controls, immutable ledger entries, disputes, and late-capture
  anomalies that do not revive expired commitments.
- Published fixed-price booking slots with advisory/row locking, exact 7–14-day selection,
  30-minute unpaid holds, integer-kobo 30% deposit snapshots, explicit policy acceptance,
  one qualifying customer reschedule, business-disruption transfer/refund choices, and durable
  versioned 7-day/72-hour/48-hour/24-hour reminders.
- Support enquiries and complaints with branch isolation, assignment, priority/status transitions,
  customer-visible versus internal append-only messages, and authenticated incremental chat.
- Rated reviews for the overall business, verified service bookings, completed orders, completed
  vehicle sales, and verified product purchases. Public output is moderation-gated and omits
  customer identity. Product reviews are limited to one per customer/product.
- Durable in-app notifications, channel preferences, mandatory security/transactional behavior,
  encrypted email/SMS outbox payloads, safe templates, staging recipient allowlists, timeouts,
  retries, lease recovery, deduplication, and dead-letter visibility.
- Administrative audit and operations endpoints for bounded audit search, queue state, controlled
  retries, payment anomalies, disputes, refunds, and reconciliation status without raw payloads or
  private object keys.
- One synthetic staging branch plus three synthetic services through an idempotent, guarded,
  serializable seed. Multi-branch data structures remain supported without forcing branch selection
  while exactly one active branch is eligible.
- Thirty forward migrations replay from an empty PostgreSQL database. Enum-only migrations commit
  booking/payment-provider and `PRODUCT` review values before later constraints reference them,
  preventing PostgreSQL error `55P04` in Prisma shadow or replay databases.

## Implemented but requiring staging verification

- Resend delivery from a verified staging sender and only to the email allowlist.
- Optional Termii SMS from the account-specific HTTPS Termii base URL and only to the SMS allowlist.
- Paystack test and Monnify sandbox initialization, callbacks, signed/unsigned-sandbox webhook
  handling, authoritative verification, reordered events, refunds, and reconciliation.
- Private Spaces uploads/downloads, checksum verification, MIME/size enforcement, and expiry of
  signed access.
- Managed PostgreSQL `verify-full` TLS using the materialized absolute CA file.
- Vercel same-origin `/api/v1/*` forwarding, cookie/CSRF behavior, cache bypass, request IDs,
  timeouts, and chat polling.
- Effective DigitalOcean/Vercel proxy chain before approving the final `TRUST_PROXY_HOPS` value.
- Centralized logs, alerts, dead-letter monitoring, worker restarts, and backup restore evidence.

## Blocked by business decisions

The detailed owner questions are in `owner-decision-checklist.md`. The live-launch blockers are
delivery areas/fees, cancellation/refund terms, vehicle deposit policy, tax/invoice terms, dispute
ownership, retention/account deletion, support response targets, and approved customer messaging.
Collection checkout and the read-only discovery milestone can be staged before these are approved.
Delivery checkout deliberately returns a conflict instead of silently charging an invented fee.

## Blocked by infrastructure or credentials

- Owner-approved domain, DigitalOcean/Cloudflare/Vercel access, region, resource sizes, and budget.
- Private DigitalOcean Container Registry and digest-pinned API, identity-worker, general-worker,
  and migration images.
- Standard Managed PostgreSQL staging cluster, runtime/worker/migration roles, managed CA, trusted
  sources, backup settings, and a restore-test target.
- Private staging Spaces bucket and least-privilege key.
- Independently generated staging cryptographic keys in the approved secret store.
- Paystack test credentials, Monnify sandbox credentials/contract code, Resend staging key/sender,
  recipient allowlist, and alert owners.
- Optional Termii credentials only if SMS staging tests are enabled.

## Explicitly deferred

- Automatic personal-data deletion/anonymization until the owner approves retention and legal rules.
- Live payments and live provider credentials.
- Marketing campaigns; the data model only permits explicit opt-in when a campaign is later approved.
- Automatic completion of offline refunds. Approval moves the item to operator attention until an
  evidence and settlement procedure is approved.
- OAuth/Google authentication and JWT. They are unnecessary for the same-origin browser deployment;
  adding them would introduce token, account-linking, callback, and provider trust risks without a
  current business requirement.
- WebSocket infrastructure. Support chat uses secure five-second cursor polling, which works across
  API instances and preserves cookie/CSRF controls through the planned proxy. Revisit push transport
  only after the real proxy topology and operational need are measured.

## Deployment prerequisites and order

1. Resolve the owner and infrastructure checklist; create staging-only resources and secrets.
2. Run the full local gate and record the release commit.
3. Build Linux AMD64 images for `api`, `worker`, `general-worker`, and `migrate`; publish to the
   private registry and record immutable registry digests.
4. Populate a private copy of `ops/digitalocean/staging.app.yaml.template`; never commit it.
5. Attach Managed PostgreSQL and restrict trusted sources to the App Platform app.
6. Run the digest-pinned pre-deploy migration job. A failure must prevent revision promotion.
7. Run the guarded synthetic seed twice; the second run must create nothing.
8. Start the identity and general workers, then the API. Verify liveness and database readiness.
9. Configure Vercel forwarding and DNS-only Cloudflare records, then run the browser and provider
   staging checklists.
10. Record logs, checks, exact digests, migration result, rollback-forward notes, and reviewers in a
    private release record.

## Local evidence record

The final command results for this release are recorded in the completing commit/handoff and must
include: schema validation, migration status, empty-database replay, TypeScript, script compilation,
lint, formatting, OpenAPI validation, unit/API/integration tests, dependency audit triage, secret
scans, Linux container builds, and local runtime health. Database/provider/browser tests that were
skipped must be named rather than counted as passes.

## Operations and recovery

- `/api/v1/health/live` checks process liveness; `/api/v1/health/ready` requires PostgreSQL.
- Queue failures and payment anomalies are visible only through MFA-assured administrative routes.
- Migration history is forward-only. Do not rewrite, reset, or mark a failed migration applied
  without inspecting the database and using the migration runbook.
- Managed backups are not configured by repository scripts. A restore is proven only after a copy is
  restored into an isolated database and application-level checks pass.
- Loss of token/encryption keys can invalidate sessions or make encrypted pending outbox material
  unrecoverable. Keep versioned keys in the staging secret inventory and document rotation custody.

Related documents: `staging-deployment-runbook.md`, `staging-browser-authentication-checklist.md`,
`owner-decision-checklist.md`, and `frontend-integration-handover.md`.
