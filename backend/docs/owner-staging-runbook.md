# Private staging deployment — 24 September 2026

This runbook supersedes historical phase reports where they conflict with the signed owner decisions. No cloud purchase, deployment or live activation has been performed. Public launch remains gated. Use only synthetic data in private staging.

## Package, build and process commands

The repository root is not an npm workspace. Run from `backend` with Node 24.13.0 and its committed npm lockfile. Frontend remains on Vercel. Docker context is `backend`, not repository root.

```sh
cd backend
npm ci
npm run prisma:generate
npm run build
docker build --target api -t allied-autotech-api:owner-policy .
docker build --target worker -t allied-autotech-identity-worker:owner-policy .
docker build --target general-worker -t allied-autotech-general-worker:owner-policy .
docker build --target migrate -t allied-autotech-migrate:owner-policy .
```

The Docker build generates Prisma with nonsecret build-only datasource values and does not connect to a database. Push reviewed images to Mike's DOCR registry; pin their immutable digests in a private copy of `ops/digitalocean/staging.app.yaml.template`. It uses JSON syntax, which is valid YAML, and intentionally invalid placeholders. Its API, two workers and one `PRE_DEPLOY` migration job follow the [DigitalOcean App Spec](https://docs.digitalocean.com/products/app-platform/reference/app-spec/). Failed migrations must block deployment. Never migrate in API/worker startup.

| Process | Docker target / command | Environment scope |
| --- | --- | --- |
| API | `api` / `node dist/server.js` | DB/pool 10; all four crypto keys/IDs; frontend/WebAuthn URLs; HTTP/proxy/rate settings; private Spaces credentials; Paystack mode/key/callback; Monnify disabled; delivery flags. No messaging provider sending keys needed. |
| Identity worker | `worker` / `node dist/workers/outbox.worker.js` | DB/pool 3; outbox key/ID; email flag, Resend key/sender and staging allowlist when enabled; messaging timeout/batch. No payment/storage/MFA keys. |
| General worker | `general-worker` / `node dist/workers/worker-runtime.js` | DB/pool 5; token-hash, asset-ticket and outbox keys/IDs; frontend origin for signed reminder links; enabled email/SMS settings and allowlists; Paystack test key/mode; disabled Monnify; polling/expiry/reconciliation controls. No Spaces or MFA secret. |
| Migrator | `migrate` / `node node_modules/prisma/build/index.js migrate deploy` | Only mode and DB host/port/name/migration-role/password/strict TLS CA. No provider or application keys. `DB_POOL_MAX` does not control Prisma CLI connections. |

The [exact per-component variable matrix](runtime-environment-matrix.md) is generated from the App Platform template.

Use `.env.staging.example` and `.env.production.example` as placeholder inventories, not deployable credentials. Boolean values are exactly lowercase `true`/`false`; origins and allowlists are comma-separated and trimmed. Optional disabled-provider fields accept blanks. Do not enable test/replay database flags in hosting. Production defaults leave payment collection and messaging disabled.

## What Mike must obtain

1. **DigitalOcean:** choose region/sizes; create staging Managed PostgreSQL, private Spaces and DOCR. Obtain DB host, port, CA PEM and separate runtime/migration roles. Restrict DB trusted sources. Enable backups and test restoration into an isolated database. Production later requires distinct database, bucket, keys and credentials.
2. **Database permissions:** migration owner can run DDL. API/workers have schema usage and application DML, including default privileges for newly migrated tables, but must not own tables or have DDL, superuser, trigger-disable or role-management permission. Revoke public schema creation. Verify both roles independently; do not use a database superuser for the API.
3. **Spaces:** bucket-scoped read/write credentials for the API without permission to publish the bucket. Keep sensitive documents private; no private-bucket CDN. Configure exact frontend CORS for direct PUT uploads and their checksum/content headers. Test metadata validation, ticket expiry, cross-customer rejection and short-lived GET access. Existing public catalog projection remains separate.
4. **Resend:** verify a controlled sender domain; obtain a staging key and sender address. Populate `STAGING_EMAIL_ALLOWLIST` with real consenting testers. Enable email consistently on API and workers after controlled tests. Disabled delivery never marks a message delivered or bypasses account verification. Inspect encrypted test events only through an authorized operator process, never a public token endpoint.
5. **Termii:** obtain the dashboard-assigned HTTPS `termii.com` API host, approved sender and key. Populate the E.164 staging SMS allowlist before enabling delivery. Do not guess phone numbers or email addresses for the named business contacts.
6. **Paystack:** select test mode, obtain the test secret, set the exact frontend callback and direct API webhook `https://<api-host>/api/v1/webhooks/paystack`. Keep `PAYSTACK_LIVE_ENABLED=false`, Monnify disabled and its credential/callback fields blank. Webhooks must bypass interactive Cloudflare login and retain exact raw bytes for HMAC SHA512. See [Paystack webhooks](https://paystack.com/docs/payments/webhooks/).
7. **Application keys:** generate four independent 32-byte base64 keys for token hashing, MFA encryption, outbox encryption and asset tickets. Share the appropriate purpose/key ID across replicas within staging; use distinct production keys. Never rotate without a migration/key-version compatibility plan.

Do not put populated `.env` files or private App Platform specs in git or image layers. Scope secrets to the process table above.

## Verified TLS and connection budget

All hosted processes use `NODE_ENV=production`, `DEPLOYMENT_ENV=staging`, `DB_SSL_MODE=verify-full`, and `DB_SSL_CA_FILE=/tmp/allied-autotech-secrets/database-ca.pem`. Base64-encode the complete CA PEM into secret `DB_SSL_CA_BASE64`.

The entrypoint `docker/with-database-ca.sh` decodes it, rejects empty/oversized/malformed material and private keys, writes atomically with mode 0400, unsets the helper secret and execs Node/Prisma. Existing `DB_SSL_CA_CERT` is a compatibility alternative; never configure both. This helper is an entrypoint variable, not a Node-parser setting.

Runtime `pg` uses explicit credentials and CA verification, including hostname checking. The separately constructed Prisma URL uses strict TLS parameters and the absolute CA path. An arbitrary `DATABASE_URL` cannot override either. From an authorized operator environment run `npm run check:db-tls`; separately run migration with its role and CA. Verify wrong-CA and wrong-hostname rejection against a disposable TLS endpoint. A disposable local TLS handshake test also verifies wrong-hostname and untrusted-certificate rejection. Neither proves a DigitalOcean TLS connection or a real Prisma migration TLS handshake was exercised.

One API/identity/general worker totals 18 maximum runtime connections (10+3+5); overlapping old/new generations total 36. Reserve migration connections and operator headroom beyond that. Two API replicas use 28 steady/56 overlap. Measure migration concurrency and compare against the actual Managed PostgreSQL limit before selecting a plan. There is one shared Prisma/pg pool per runtime process; the operator TLS check uses one additional connection.

## Browser/proxy configuration and pre-login 429s

The existing Vercel frontend rewrites `/api/v1/*` to `BACKEND_ORIGIN`. Configure that origin as HTTPS; browser fetches remain relative, with credentials and session-bound CSRF headers. The existing CSRF policy requires exact trusted Origin and `Sec-Fetch-Site: same-origin`; switching browsers to direct cross-origin API calls breaks that contract. WebAuthn RP ID belongs to the calling frontend hostname, not the API hostname.

Previously normal traffic had a 300-per-15-minute in-memory budget shared with health traffic. Hosted counters now use PostgreSQL; default normal browsing is 300/minute, sensitive auth/OTP/reset policies remain separate, and responses include `Retry-After`. Health and provider callbacks do not consume the browsing bucket.

Start with `TRUST_PROXY_HOPS=0`. Measure the actual Cloudflare/Vercel/App Platform chain before configuring narrow `TRUST_PROXY_CIDRS`. Unrestricted ranges and hosted hop-only trust are rejected. Verify forged forwarding headers through both the intended ingress and the default platform hostname. Restrict alternate host access where supported, or apply equivalent protections everywhere. If a trustworthy client-IP chain cannot be established, keep staging restricted until it is resolved; local tests cannot supply real ingress CIDRs.

Hosted `API_DOCS_ENABLED=false` is mandatory, including staging with `NODE_ENV=production`. Share the private OpenAPI/handbook artifacts instead. This avoids a docs bypass on the default hostname. Keep business ingress private while permitting required health probes and signed provider callbacks.

## Migration, bootstrap and smoke checks

1. Back up and review additive migrations. Run the migration image once in `PRE_DEPLOY`; never reset data, rewrite applied migrations or set migration-test flags in hosting. Check failure blocks deployment in a disposable staging deployment.
2. API binds `0.0.0.0:$PORT` (5000 in the spec). Check `/api/v1/health/live` and `/api/v1/health/ready`; readiness performs a bounded DB check, not a provider smoke test. Start both workers and monitor their persisted heartbeats through `/admin/operations/status`.
3. In an authorized checkout, inspect the selected existing verified account with `npm run bootstrap:super-admin -- --email <real-email>`. After checking its UUID, add `--expected-user-id <id> --apply`. The existing script creates no user/password, never auto-verifies, enforces one owner and revokes previous sessions. Complete MFA. Do not widen the existing invitation policy or invent accounts for named staff.
4. Grant narrow capabilities to real verified accounts: refund approval/transfer/check; booking confirmation; finance approval; dispute management; privacy review. Refund requester, approver, operator and checker must differ even when administrators hold multiple capabilities.
5. Publish real approved branch capacity/opening days before staff confirmation. Obtain delivery and finance approvals before enabling those live operations. Vehicle deposits, marketing and destructive retention remain blocked pending their unresolved decisions.
6. Test verification/reset/MFA/session revocation, collection checkout, stock races/expiry, late payment exceptions, owned invoice reads, private evidence, staff confirmation and signed reminder actions. Run two API replicas to check shared sessions/limiter behavior.
7. Exercise Paystack test initialize/verify, signed events, replay/mismatch, refund pending/processed/failed states and dashboard reconciliation. Refund request acceptance is not completion. Unknown POST outcomes must be reconciled without a second submission. Sandbox contract mocks do not prove real settlement; see [Paystack refund lifecycle](https://paystack.com/docs/payments/refunds/).
8. Monitor failed jobs, operational alerts, refund/dispute/anomaly queues and missing/stale worker heartbeats. Stop/restart workers during disposable jobs and confirm recovery and clean shutdown. Agree operational responders and out-of-hours coverage. Missing email routing remains visible in the API; no external paging service is implicitly configured.

When cutting over from the old deposit/auto-confirmation behavior, keep staging business ingress closed and drain/stop old workers before exposing the new API and workers. Additive schema compatibility does not make mixed financial policy versions safe. Reopen only after the new process set and policy gates pass smoke checks.

Rollback images by immutable digest only after compatibility review. Preserve additive schema and financial/policy history; do not run destructive down migrations. Old auto-confirming deposit code must not be reactivated against the new booking policy.

## Frontend and owner handoff

Frontend source was inspected read-only; unrelated user edits are preserved. Its older deposit wording/assumptions need a separate frontend update to use `owner-booking-request-v2`, no new deposit, staff confirmation, capabilities and VAT totals. New staff workflows are available in the API; a new staff UI was not built here.

Outstanding owner inputs: delivery zones/fees; vehicle deposit/hold anchor and expiry/delayed-confirmation rules; cancellation equality and full fee/partial basis; return collection anchor/boundary/exceptions; bank-refund start event and banking holidays; workshop capacity/calendar; accounting applicability/rounding/discount/delivery/invoice identity/terms; dispute and complaint accounts/emails/calendars; marketing wording/sender/consent/unsubscribe; record-specific retention rules. See [the implementation matrix](owner-implementation-matrix.md).
