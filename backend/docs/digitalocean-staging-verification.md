# Staging deployment verification — 28 September 2026

**Local preparation verified; cloud deployment not executed.** DigitalOcean CLI
1.175.0 is installed from the official release with its published SHA256 checksum
verified. Authenticated account access now succeeds. No registry, database,
Space, App Platform app, custom domain or DNS record was created or modified.
Read-only inventory confirms no registry, app, managed database or VPC. The
default project is `first-project` and has no attached resources. Spaces has no
access keys; bucket inventory remains unverified. See the current
[resource and cost proposal](digitalocean-staging-resources.md).

## Existing architecture and correction

The existing Dockerfile builds Prisma during build without a real DB connection,
then runs compiled JavaScript. The API binds `0.0.0.0` using the configured port
(5000 in the spec). Readiness is `/api/v1/health/ready`; liveness is
`/api/v1/health/live`. PRE_DEPLOY runs
`node node_modules/prisma/build/index.js migrate deploy`, independently of startup.
Both workers have no exposed ports. All four images run as UID 1000 through
`aat-with-database-ca`. Runtime TLS verifies certificates/hostnames; Prisma uses
its separately constructed strict-TLS URL.

The Windows checkout had CRLF in `docker/with-database-ca.sh`. Images built
successfully but their entrypoint could not execute under Linux. Normalizing the
working file to LF and adding `.gitattributes` fixed actual startup. A new Docker
test now catches this failure, including the misleading case where negative CA
tests fail because the entrypoint never starts.

Next.js uses server-only `BACKEND_ORIGIN` and same-origin `/api/v1/*` rewrites.
No frontend source was changed by this deployment work. After the custom API
domain works over HTTPS, set Vercel:
`BACKEND_ORIGIN=https://api-staging.alliedautotech.com`, then redeploy.

## Files

| Path (repository relative) | Change |
| --- | --- |
| `.gitattributes` | Preserve LF for Linux container shell entrypoints on Windows. |
| `backend/docker/with-database-ca.sh` | Working-copy line endings normalized; shell logic unchanged. |
| `backend/.gitignore` | Ignore the entire private deployment input/evidence directory. |
| `backend/scripts/deployment/release.ps1` | PowerShell entrypoint with fail-fast exit propagation. |
| `backend/scripts/deployment/release.mjs` | Prerequisites/account inventory, private files/ACLs, stable key generation, builds, pushes, digests, spec generation and provider validation. |
| `backend/scripts/deployment/spec.mjs` | Validate release provenance, required inputs, independent keys, CA and process scopes; fill the existing template. |
| `backend/scripts/deployment/spec.test.mjs` | Spec safety and invalid-input regression tests. |
| `backend/scripts/deployment/postgres.test.mjs` | Disposable PostgreSQL role/default-privilege verification. |
| `backend/scripts/deployment/images.test.mjs` | Real-image command, UID, port, CA permission/unset and rejection tests. |
| `backend/ops/digitalocean/staging.app.yaml.template` | Actual staging frontend hostname, 1-GiB single instances, managed DB attachment, provider-supplied port placeholder. |
| `backend/ops/digitalocean/inputs.example.json` | Placeholder-only private input inventory. |
| `backend/ops/digitalocean/spaces-cors.json` | Exact frontend origin and upload/read methods/headers. |
| `backend/ops/digitalocean/release-record.template.md` | Correct image repository names and explicitly disabled Monnify. |
| `backend/ops/postgres/staging-privileges.sql` | Guarded dedicated staging DML/DDL grants and default privileges. |
| `backend/ops/postgres/README.md` | Role setup, verification, strict TLS, trusted sources and pool budget. |
| `backend/docs/owner-staging-runbook.md` | Link to the executable release workflow. |
| `backend/docs/digitalocean-staging-release.md` | Exact Windows workflow, provider inputs, cloud commands, DNS/Vercel and acceptance checks. |
| `backend/docs/digitalocean-staging-resources.md` | Authenticated account inventory, available plans, cost proposal and resource creation sequence. |
| `backend/docs/digitalocean-staging-verification.md` | This evidence/remaining-work report. |

The locally ignored `.env.staging.example` was also sanitized: removed its Resend
credential/sender, disabled email and corrected the frontend hostname. It is not
a tracked deliverable. No real `.env` was edited. Private `inputs.json` contains
only placeholders, and private `build.json` records local evidence; neither is
tracked. Four independent staging keys have now been generated once in protected
private `keys.json`; their values are not displayed. No real populated App Spec
has been generated.

## Images and DOCR

Local verification tag for all four images:
`4128353246b4c620259c44b0fc5e4a8562376814` (current HEAD).
These are explicitly **dirty-worktree verification builds**, not a published
release. The helper refuses to push them. After review/commit, archive this local
build record, rebuild and test the clean release, then push with its new full SHA.

| Component | Repository | Target | Actual command | DOCR digest |
| --- | --- | --- | --- | --- |
| API | `allied-autotech-api` | `api` | `node dist/server.js` | Not pushed; unavailable |
| Identity | `allied-autotech-identity-worker` | `worker` | `node dist/workers/outbox.worker.js` | Not pushed; unavailable |
| General | `allied-autotech-general-worker` | `general-worker` | `node dist/workers/worker-runtime.js` | Not pushed; unavailable |
| Migrator | `allied-autotech-migrate` | `migrate` | `node node_modules/prisma/build/index.js migrate deploy` | Not pushed; unavailable |

Local image IDs are recorded privately; they are not claimed as remotely resolved
DOCR digests. The push helper will populate a separate release manifest using the
registry's tag-to-manifest response. No `latest` tag is used.

## Environment state

| Category | State |
| --- | --- |
| Known | Staging hostnames, process commands, API port, strict TLS mode/CA path, per-process scopes, pool sizes, disabled docs/proxy trust, stable key IDs. |
| Generated | Four independent 32-byte Base64 staging keys in protected, ignored `keys.json`; preserve them across deployments. |
| DigitalOcean supplied | Account access and default project verified; London is available. No registry/managed cluster exists yet. Actual hostname/port/CA, separate DB credentials, private bucket and scoped Spaces keys remain unavailable. |
| Paystack supplied | Actual test secret still required by API/general-worker parser; live charging disabled. |
| Resend supplied | No active key/sender supplied. Historical key requires revocation/rotation. Sender-domain DNS records must come from Resend. |
| Termii supplied | Not needed initially; no credentials assumed. |
| Intentionally blank/disabled | Resend sending fields, email/SMS delivery, recipient allowlists, Termii configuration and Monnify credentials/callback. |

The spec retains API/identity/general pools of 10/3/5: 18 steady and up to 36 with
overlap, plus measured Prisma migration/operator headroom. Real database capacity
and trusted sources require an actual cluster. Provider limits show the 2-GiB
plan allows 47 connections; the 1-GiB plan's 22 cannot cover rolling overlap. `DB_POOL_MAX` in the
migration environment does not set the Prisma CLI's pool limit.

## Verification results

| Check | Result |
| --- | --- |
| Explicit Linux/amd64 builds for all four targets through `release.ps1 build` | Passed after LF correction. |
| `node --test scripts/deployment/spec.test.mjs` | 16 passed. |
| `node --test scripts/deployment/postgres.test.mjs` | 1 passed; isolated PostgreSQL 17 container removed. Tests DML, future-table grants, DDL/role/truncate/ledger denial and wrong-role/database guards. |
| `node --test scripts/deployment/images.test.mjs` | 5 passed after rebuild; actual CA entrypoint, UID 1000, 0400 file, helper unset and invalid-material/path rejection. |
| Existing `database-tls`, `process-environment`, `database-tls-handshake` test files | 3 files / 8 tests passed, including untrusted-CA/wrong-hostname rejection on a disposable local TLS endpoint. |
| `npm run build`, `typecheck`, `check:scripts`, `lint`, `format:check` | Passed. |
| DigitalOcean `apps spec validate --schema-only` | Passed on the template with doctl 1.175.0; output withheld. This does not validate real resources/credentials or prove deployment readiness. |
| Current-file `npm run check:secrets` | Passed. |
| `npm run check:secrets:history` | Failed: historical Resend API key; rotation required. No key reproduced here. |
| Private directory protection | Git ignore and Windows ACL verified: current user + SYSTEM. |
| DOCR push / real populated-spec validation | Not run: no registry exists; new resource decision and required inputs pending. Authentication now works. |
| PRE_DEPLOY migration / Managed PostgreSQL TLS and permissions | Not run against DigitalOcean. Local fixture tests are not cloud evidence. |
| API readiness / worker heartbeats on App Platform | Not run; no app exists. Container entrypoint probes do not start the full business processes. |
| Spaces signed upload/download / metadata / private denial | Not run against a real bucket. Prepared exact CORS matches existing adapter headers. |
| Paystack test transaction/webhook | Not run against provider; no live payment enabled. |
| Messaging | Disabled; no messages sent. |
| Frontend-to-cloud auth/session/CSRF/WebAuthn/proxy tests | Not run; real ingress unavailable. Existing architecture preserved. |

## Goal requirement audit

| Phases | Evidence / next dependency |
| --- | --- |
| 0–1: inspect, preserve and verify Docker | Repository inspection, unchanged application architecture, four builds and image tests; LF startup defect corrected. |
| 2–3, 18–19: registry, helpers, CLI and push | Helpers implemented/tested locally; authenticated inventory complete. New registry required for login/push/digests. |
| 4–5: App Platform topology and API | Schema-valid template has API + two nonpublic workers + PRE_DEPLOY migrator, verified commands/health paths, one instance each. Actual app uncreated/unverified. |
| 6–8: database, CA and independent keys | Role SQL tested in isolation, strict CA bootstrap exercised; real managed DB/CA still required. Provider limits checked and four new staging keys generated once without replacing existing files. |
| 9–10: frontend/WebAuthn and proxy | Correct exact URLs/RP ID; frontend routes verified read-only. Trust remains zero/empty pending actual topology measurements. |
| 11–15: Spaces and providers | Private storage CORS prepared; actual bucket/test key/provider checks pending. Email/SMS/Monnify disabled. Historical Resend key reported for rotation. |
| 16–17: scopes/private spec | Template scopes retained; generated-spec tests pass, private ACL verified and keys generated. Real provider values and pushed digests still required. |
| 20–23: apply, domain, Vercel and migrations | Exact runbook and concrete resource proposal prepared. Applying requires new resources and valid spec. DNS target cannot be determined before an actual healthy app exists. |
| 24–25: smoke/security checks | Local tests and current-file scan pass; cloud smoke/security assertions remain unproven. History scan correctly flags compromised credential. |
| 26–27: frontend preserved/report | Frontend remains on Vercel with same-origin rewrite; this report separates local evidence from all outstanding cloud actions. |

## Smallest next action

The owner explicitly withheld spending approval while asking about cheaper
options. Neither the $70.45 proposal nor the conditional $45.15 alternative is
approved. No billable resources or deployments may be started until the owner
explicitly approves. The lower-cost alternative is documented, not applied or
capacity-validated.

Authentication is complete. Review the [new resource proposal](digitalocean-staging-resources.md):
approximately US$70.45/month base, plus migration-job usage, taxes and overages.
The account contains no existing backend resources to reuse; a spending decision
is pending before creation. Add the actual Paystack test secret locally to
`backend/ops/digitalocean/.private/inputs.json` under `values.PAYSTACK_SECRET_KEY`;
do not send it in chat. Actual DB/Spaces inputs and a clean reviewed release
commit are also required before push/spec/application.
Resend rotation/domain verification is required before enabling email; Termii
and Monnify remain optional and are not first-deployment blockers.

No exact Cloudflare DNS target is available yet. Once DigitalOcean reports it,
configure the API hostname with its exact target, DNS-only initially, then verify
TLS and ingress behavior before changing Vercel or enabling Cloudflare proxying.
