# First staging deployment runbook

## Scope and release boundary

This runbook prepares the first Allied AutoTech staging release for:

- a separately owned frontend deployed to Vercel;
- an API container on DigitalOcean App Platform;
- a separate pre-deploy migration container;
- a separate DigitalOcean Managed PostgreSQL cluster; and
- a private, staging-only DigitalOcean Spaces bucket.

The first frontend integration validates public branch listing/details and
public service listing/details. The deployed API still contains its protected
and mutation routes; those routes retain their existing authentication,
authorization, CSRF, idempotency, validation, and lifecycle controls. This
milestone does not redefine the API as read-only.

The support module is part of this release: branch-scoped enquiries and
complaints, customer-visible/internal append-only chat, assignment, deliberate
status transitions, rated overall and transaction-backed reviews, moderation,
notifications, and safe public projections. Product reviews require an owned
completed order item and are limited to one per customer/product. The enum
extension is committed in one migration before a later migration references it,
which prevents PostgreSQL's unsafe-new-enum-value migration failure.

Hosted Swagger and hosted OpenAPI remain disabled. Share
`docs/api/allied-autotech.openapi.json` and `docs/api/endpoint-handbook.md`
through an approved private channel. Both are generated from the same registry
and `npm run check:openapi` rejects stale artifacts.

## Delivery state

### Complete locally

- The App Platform template defines digest-pinned API, identity-worker,
  general-worker, and `PRE_DEPLOY` migration components.
- All four images materialize the managed PostgreSQL CA at the fixed absolute
  path required by `DB_SSL_CA_FILE` before starting Prisma.
- Component-specific environment variables contain placeholders or managed
  database bindings only.
- The public staging seed is transactional, idempotent, synthetic, audited,
  and fail-closed on drift.
- The container and backend verification commands can run without cloud
  accounts.

### Requires account access, a domain, or budget approval

- DigitalOcean project, private container registry, App Platform capacity,
  Managed PostgreSQL, Spaces, access keys, trusted sources, and alert targets.
- Vercel project access and the actual framework-specific routing change in the
  teammate's repository.
- Cloudflare zone access and the owner-supplied domain.
- Paystack test credentials and Monnify sandbox credentials/contract code.
- Staging secret generation/storage and named operational owners.

### Requires post-deployment validation

- App Platform's effective proxy/header chain and the final
  `TRUST_PROXY_HOPS` value.
- Database CA materialization, migration completion, readiness, and TLS
  hostname verification in the deployed components.
- Vercel path preservation, response headers, cookie forwarding, cache bypass,
  request IDs, and timeout behavior.
- Cloudflare DNS-only resolution to Vercel and Vercel-issued TLS.
- Synthetic public endpoint results and absence of sensitive log data.

## App Platform specification

Use `ops/digitalocean/staging.app.yaml.template` as a review source. Copy it to
a private temporary location, replace every `REPLACE_*` marker, and never
commit the populated copy. The invalid digest markers deliberately prevent an
accidental deployment of the template.

The template attaches an existing production-class managed database to the app
as `staging-db`; in DigitalOcean terminology, `production: true` distinguishes
a Managed Database from an App Platform development database. It does not mean
the Allied AutoTech environment is production.

Use the same DigitalOcean region/VPC for App Platform and PostgreSQL. The
current application accepts discrete host/port/user/password settings, so the
template uses the documented database bindables and verifies the public
database hostname with the managed CA. Restrict the database trusted sources
to the App Platform app, plus a temporary operator IP only while the guarded
seed is being run. Do not place PostgreSQL on an application instance.

Use a **Standard Edition** Managed PostgreSQL cluster for this first staging
release. The current runtime deliberately requires an explicit CA file, while
DigitalOcean Advanced Edition expects clients to use the system trust store.
Changing that trust model requires a separate reviewed application change.

The service health check uses `/api/v1/health/ready`, which requires a working
database. The independent liveness check uses `/api/v1/health/live` and does
not require PostgreSQL. The ingress rule preserves `/api/v1` because the
Express router expects the complete prefix.

Do not add a run-command override in App Platform: doing so can bypass the
container entrypoint that materializes the database CA.

## Container publication and registry digests

No command in this section was executed against a remote registry while this
runbook was prepared.

Prerequisites are Docker Buildx, an authenticated `doctl`, a private
DigitalOcean Container Registry, a reviewed release commit, and a clean backend
working tree. DigitalOcean App Platform container images must be Linux AMD64.

From the repository root in PowerShell:

```powershell
$ReleaseSha = (git rev-parse HEAD).Trim()
if ($ReleaseSha -notmatch '^[0-9a-f]{40}$') { throw 'Release commit is invalid' }

npm --prefix backend ci
npm --prefix backend run check

docker buildx build --platform linux/amd64 --target api `
  --build-arg "VCS_REF=$ReleaseSha" `
  --tag "allied-autotech-backend-api:$ReleaseSha" --load backend

docker buildx build --platform linux/amd64 --target worker `
  --build-arg "VCS_REF=$ReleaseSha" `
  --tag "allied-autotech-backend-identity-worker:$ReleaseSha" --load backend

docker buildx build --platform linux/amd64 --target general-worker `
  --build-arg "VCS_REF=$ReleaseSha" `
  --tag "allied-autotech-backend-general-worker:$ReleaseSha" --load backend

docker buildx build --platform linux/amd64 --target migrate `
  --build-arg "VCS_REF=$ReleaseSha" `
  --tag "allied-autotech-backend-migrate:$ReleaseSha" --load backend
```

Run the local container checks in this runbook before authenticating to the
registry. Then publish only after approval:

```powershell
$RegistryName = 'REPLACE_PRIVATE_REGISTRY_NAME'
$RegistryHost = "registry.digitalocean.com/$RegistryName"
$ApiRef = "$RegistryHost/allied-autotech-backend-api:$ReleaseSha"
$IdentityWorkerRef = "$RegistryHost/allied-autotech-backend-identity-worker:$ReleaseSha"
$GeneralWorkerRef = "$RegistryHost/allied-autotech-backend-general-worker:$ReleaseSha"
$MigrationRef = "$RegistryHost/allied-autotech-backend-migrate:$ReleaseSha"

doctl registries login
docker tag "allied-autotech-backend-api:$ReleaseSha" $ApiRef
docker tag "allied-autotech-backend-identity-worker:$ReleaseSha" $IdentityWorkerRef
docker tag "allied-autotech-backend-general-worker:$ReleaseSha" $GeneralWorkerRef
docker tag "allied-autotech-backend-migrate:$ReleaseSha" $MigrationRef
docker push $ApiRef
docker push $IdentityWorkerRef
docker push $GeneralWorkerRef
docker push $MigrationRef

docker pull $ApiRef
docker pull $IdentityWorkerRef
docker pull $GeneralWorkerRef
docker pull $MigrationRef
$ApiDigestRef = docker image inspect --format '{{index .RepoDigests 0}}' $ApiRef
$IdentityWorkerDigestRef = docker image inspect --format '{{index .RepoDigests 0}}' $IdentityWorkerRef
$GeneralWorkerDigestRef = docker image inspect --format '{{index .RepoDigests 0}}' $GeneralWorkerRef
$MigrationDigestRef = docker image inspect --format '{{index .RepoDigests 0}}' $MigrationRef
$ApiDigest = ($ApiDigestRef -split '@', 2)[1]
$IdentityWorkerDigest = ($IdentityWorkerDigestRef -split '@', 2)[1]
$GeneralWorkerDigest = ($GeneralWorkerDigestRef -split '@', 2)[1]
$MigrationDigest = ($MigrationDigestRef -split '@', 2)[1]

if ($ApiDigest -notmatch '^sha256:[0-9a-f]{64}$') { throw 'API digest is invalid' }
if ($IdentityWorkerDigest -notmatch '^sha256:[0-9a-f]{64}$') { throw 'Identity worker digest is invalid' }
if ($GeneralWorkerDigest -notmatch '^sha256:[0-9a-f]{64}$') { throw 'General worker digest is invalid' }
if ($MigrationDigest -notmatch '^sha256:[0-9a-f]{64}$') { throw 'Migration digest is invalid' }

"API=$ApiDigestRef"
"IDENTITY_WORKER=$IdentityWorkerDigestRef"
"GENERAL_WORKER=$GeneralWorkerDigestRef"
"MIGRATION=$MigrationDigestRef"
docker logout $RegistryHost
```

Record all four full `repository@sha256:...` references, the full Git commit, UTC
time, reviewer, and deployment result in a private copy of
`ops/digitalocean/release-record.template.md`. Put only the digest portion in
the matching App Platform `image.digest` field. Never use `latest`, a mutable
tag, or digest plus tag. Keep autodeploy disabled for the first release.

Registry digests are authoritative deployment identifiers; local Docker image
IDs are useful local evidence but are not substitutes for registry digests.

## PostgreSQL CA delivery

The App Platform template binds `${staging-db.CA_CERT}` to the encrypted,
runtime-only `DB_SSL_CA_CERT` variable for the API, both workers, and migration job. At
container start, `docker/with-database-ca.sh`:

1. requires `DB_SSL_MODE=verify-full` and the exact destination
   `/tmp/allied-autotech-secrets/database-ca.pem`;
2. writes the CA with a restrictive umask through a same-directory temporary
   file;
3. rejects empty, oversized, malformed, or private-key-bearing content;
4. atomically moves it into place with mode `0400`;
5. removes `DB_SSL_CA_CERT` from the environment inherited by Node; and
6. starts the image command without a shell.

Do not paste the CA into Git, an image layer, the App Spec template, a command
argument, or a log. Do not configure another destination path. Both a
successful migration and a ready API provide end-to-end evidence that Prisma
could read the absolute file and establish the configured connection.

After deployment, use the App Platform console only to inspect metadata, never
certificate content:

```sh
test -f /tmp/allied-autotech-secrets/database-ca.pem
test "$(stat -c '%a' /tmp/allied-autotech-secrets/database-ca.pem)" = "400"
test -z "${DB_SSL_CA_CERT:-}"
```

The console is privileged. Limit App Platform console access to operators who
are authorized to access runtime secrets.

## Component environment inventory

The App Platform template is the authoritative key list.

API-only configuration includes HTTP/CORS/proxy/rate-limit settings; four
independently generated cryptographic keys and their version IDs; WebAuthn and
frontend URLs; the Paystack **test** and Monnify **sandbox** credentials/callbacks;
and staging-only private Spaces settings. `API_DOCS_ENABLED` must remain `false`.
Both `PAYSTACK_LIVE_ENABLED` and `MONNIFY_LIVE_ENABLED` remain `false`.

For Spaces, `OBJECT_STORAGE_ENDPOINT` contains the DigitalOcean region, while
`OBJECT_STORAGE_REGION` remains `us-east-1` as required by DigitalOcean's AWS
SDK guidance. Keep virtual-hosted-style requests enabled with
`OBJECT_STORAGE_FORCE_PATH_STYLE=false`.

The migration job receives only `NODE_ENV`, discrete PostgreSQL credentials,
TLS mode, CA destination, and CA binding. It does not receive identity,
payment-provider, object-storage, email, or frontend configuration.

The identity worker receives only database/outbox encryption and Resend
delivery settings. The general worker receives database/outbox encryption,
notification providers, Paystack test/Monnify sandbox reconciliation, and bounded
worker schedules. It owns booking hold expiry, versioned 7-day/72-hour/48-hour/
24-hour reminders, webhook retry, notification delivery, and reconciliation.
SMS remains explicitly disabled unless Termii staging credentials,
its account-specific HTTPS base URL, sender, and recipient allowlist are added.

Shared database values are repeated at component scope deliberately so future
components do not inherit secrets they do not need. All credentials, provider
keys, cryptographic keys, and CA material use encrypted `SECRET` variables with
`RUN_TIME` scope. Placeholder text is not a usable secret and must be replaced
in the DigitalOcean control panel before deployment.

Generate each 256-bit application key independently in a controlled operator
session and store it in the staging secret inventory. Never reuse development
or production keys, and never reuse one key for two purposes.

The App Spec deploys both workers. Do not invite users to exercise registration,
recovery, notification, booking reminder, webhook, or expiry flows until those workers are healthy
and staging recipient/provider safeguards have been verified.

## Vercel routing handoff

The teammate must implement this in the actual frontend repository after
checking its framework and existing route precedence. Do not copy or infer
configuration from this repository's placeholder frontend.

Required behavior:

- Browser code calls relative URLs such as `/api/v1/public/branches`; it does
  not call the DigitalOcean origin directly.
- `/api/v1/:path*` is an external rewrite to
  `https://REPLACE_DO_APP_HOST/api/v1/:path*`; it is not a redirect.
- Methods, query strings, request bodies, `Set-Cookie`, `Cookie`, `Origin`,
  `Sec-Fetch-Site`, `X-CSRF-Token`, `Idempotency-Key`, and `X-Request-ID` must
  survive the proxy path.
- Rewrite caching is explicitly disabled for all `/api/v1/*`. Do not add a
  blanket cache policy just because the first integration endpoints are public
  reads; the same prefix contains authenticated and mutation routes.
- No Paystack, Monnify, database, Spaces, or backend application secret is placed in
  Vercel or the browser bundle for this milestone.

If the repository uses `vercel.json`, merge the equivalent of the following
with its existing configuration. Otherwise use the framework-supported Vercel
mechanism that produces the same behavior:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://REPLACE_DO_APP_HOST/api/v1/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/v1/:path*",
      "headers": [{ "key": "x-vercel-enable-rewrite-caching", "value": "0" }]
    }
  ]
}
```

Test the rule in a Vercel preview before assigning the staging domain. Confirm
there is no frontend file or serverless function that captures `/api/v1/*`
before the external rewrite.

In Cloudflare, create only the DNS record Vercel tells the teammate to create
for `REPLACE_STAGING_FRONTEND_HOST`, and keep Proxy Status **DNS only**. Vercel,
not Cloudflare's reverse proxy, terminates TLS in this initial topology. Do not
guess Vercel's CNAME target; copy the value shown for that project/domain in
the Vercel dashboard.

## Synthetic public staging data

`npm run seed:staging:public` creates one clearly labelled synthetic branch
and three clearly labelled synthetic services. It has four safety properties:

- it requires `DEPLOYMENT_ENV=staging`, an explicit versioned confirmation,
  and a database name containing `staging`;
- all writes and append-only audit entries run in one serializable transaction
  protected by a PostgreSQL advisory lock;
- rerunning with matching data is a no-op; and
- an existing matching code/slug with different fields aborts the entire
  transaction instead of updating or deleting data.

The displayed prices and locations are integration fixtures, not approved
commercial data. Do not use real customer, staff, vehicle, payment, or contact
data.

Run only after migrations succeed. The controlled workstation procedure is:

1. Download the Managed PostgreSQL CA to a protected file outside the
   repository and note its absolute path.
2. Temporarily add the operator's current public IP to the database trusted
   sources. Do not open PostgreSQL to all addresses.
3. Load the staging database credentials from the approved secret manager into
   the current process; do not place them in `.env`, shell history, or the
   command line.
4. From `backend`, set the non-secret values below and execute the seed.

```powershell
$env:NODE_ENV = 'production'
$env:DEPLOYMENT_ENV = 'staging'
$env:CONFIRM_STAGING_PUBLIC_SEED = 'allied-autotech-public-v1'
$env:DB_HOST = 'REPLACE_MANAGED_POSTGRES_HOST'
$env:DB_PORT = 'REPLACE_MANAGED_POSTGRES_PORT'
$env:DB_NAME = 'REPLACE_DATABASE_NAME_CONTAINING_STAGING'
$env:DB_USER = 'REPLACE_DATABASE_USER'
$env:DB_SSL_MODE = 'verify-full'
$env:DB_SSL_CA_FILE = 'REPLACE_ABSOLUTE_CA_FILE_PATH'

npm ci
npm run prisma:generate
npm run seed:staging:public
npm run seed:staging:public
```

The database password must already be present in `DB_PASSWORD` through the
approved secret-loading process. The second run must report zero creations.
Immediately remove the temporary trusted source and clear the process
environment/close the operator shell. If the script reports drift, stop and
review the existing records; do not edit around the guard or reset the
database.

## Deployment checklist

### Before creating the app

- [ ] Owner has approved the staging budget, region, resource sizes, and named
      operators.
- [ ] Release commit is reviewed, immutable, and contains no unrelated or
      uncommitted backend changes.
- [ ] `npm run check` and `npm run check:secrets:history` pass.
- [ ] All migrations replay from an empty disposable PostgreSQL database.
- [ ] API, identity-worker, general-worker, and migration Linux AMD64 images
      pass the local checks below.
- [ ] Private registry images are pushed and App Spec sources use recorded
      registry digests, not tags.
- [ ] Managed PostgreSQL and Spaces are staging-only; backups and access owners
      are recorded.
- [ ] Paystack is in test mode and Monnify is in sandbox mode. Both live-enable flags are false;
      no live secret or live webhook is configured.
- [ ] Every `REPLACE_*` marker is replaced in the private App Spec copy.
- [ ] Populated spec and release record contain no plaintext secret or CA.

### Local container checks

The following checks verify the entrypoint without displaying CA material:

```powershell
$SyntheticCa = "-----BEGIN CERTIFICATE-----`nSYNTHETIC-STAGING-ENTRYPOINT-CHECK`n-----END CERTIFICATE-----"
$CaPath = '/tmp/allied-autotech-secrets/database-ca.pem'

docker run --rm --entrypoint /bin/sh allied-autotech-backend-api:REPLACE_RELEASE_SHA `
  -n /usr/local/bin/aat-with-database-ca

docker run --rm -e DB_SSL_MODE=verify-full -e DB_SSL_CA_FILE=$CaPath `
  -e DB_SSL_CA_CERT=$SyntheticCa allied-autotech-backend-api:REPLACE_RELEASE_SHA `
  /bin/sh -c 'test -f "$DB_SSL_CA_FILE" && stat -c %a "$DB_SSL_CA_FILE" | grep -qx 400 && test -z "$DB_SSL_CA_CERT"'

docker run --rm -e DB_SSL_MODE=verify-full -e DB_SSL_CA_FILE=$CaPath `
  allied-autotech-backend-api:REPLACE_RELEASE_SHA /bin/true
if ($LASTEXITCODE -eq 0) { throw 'Missing CA was not rejected' }
```

The first command overrides the entrypoint only to syntax-check the script.
The next commands exercise the real entrypoint. Synthetic markers are suitable
only for this file-boundary check, never for a database connection.

### DigitalOcean deployment

- [ ] Create/attach the Standard Edition Managed PostgreSQL cluster; confirm
      PostgreSQL 17, database/user names, region, backups, and maintenance
      policy.
- [ ] Restrict PostgreSQL trusted sources to the App Platform app.
- [ ] Create a private Spaces bucket with public listing/access disabled and a
      staging-only least-privilege access key.
- [ ] Review App Platform's cost summary before clicking Create App.
- [ ] Confirm the migration job starts first, materializes the CA, applies all
      forward migrations, and exits `0`.
- [ ] If migration fails, the API revision is not promoted. Preserve logs and
      fix forward; do not reset the database or mark a migration applied
      without database review.
- [ ] Confirm API readiness becomes `200` and liveness remains `200`.
- [ ] Confirm both workers start from their recorded digests, acquire work
      safely, expose no payloads in logs, and stop cleanly during a revision change.
- [ ] Confirm the general worker claims booking reminders/expiries and both-provider
      reconciliation in bounded batches without duplicate notifications.
- [ ] Confirm the deployed image digests match the release record.
- [ ] Confirm `/api/v1/docs` and `/api/v1/openapi.json` return `404`.
- [ ] Configure Paystack test and Monnify sandbox webhooks to the stable App Platform
      hostname (`/api/v1/webhooks/paystack` and `/api/v1/webhooks/monnify`), never through Vercel.

### Public integration and TLS

- [ ] Run the guarded seed twice; the second run creates nothing.
- [ ] Through the DigitalOcean hostname, verify
      `GET /api/v1/health/live` and `GET /api/v1/health/ready`.
- [ ] Through the Vercel staging hostname, verify
      `GET /api/v1/public/branches` and capture a synthetic branch ID.
- [ ] Verify `GET /api/v1/public/branches/{branchId}` returns that branch.
- [ ] Verify `GET /api/v1/public/services` and capture fixed-price and
      quote-required synthetic service IDs.
- [ ] Verify `GET /api/v1/public/services/{serviceId}` for both pricing types.
- [ ] Verify `GET /api/v1/public/booking-policy` and an empty or synthetic
      `GET /api/v1/public/services/{serviceId}/slots` result without inventing staff availability.
- [ ] Confirm cursor pagination, invalid UUID handling, unknown-route `404`,
      stable response envelopes, and `X-Request-ID` correlation.
- [ ] Confirm HTTPS has a valid hostname chain, no mixed content, and no
      redirect loop at Vercel or App Platform.
- [ ] Confirm an unapproved `Origin` is rejected and the exact staging origin
      is accepted where CORS applies.
- [ ] Confirm Vercel reports cache bypass/no cached response for all API paths.

### Logs and completion

- [ ] Search deployment, migration, request, and error logs for passwords,
      cookies, session/CSRF/token values, CA contents, Paystack/Monnify secrets,
      hosted-checkout URLs, bank details or raw
      payloads, Spaces keys/object keys, and private customer data; none may be
      present.
- [ ] Confirm normal logs include service name, severity, request ID, method,
      path, status, and useful redacted errors.
- [ ] Confirm the API does not start with a placeholder/missing required secret,
      permissive origin, hosted Swagger, disabled DB verification, or malformed
      CA.
- [ ] Complete the private release record and assign owners for alerts,
      database backups, registry retention, and the next authentication test.

## Accounts, resources, and unresolved inputs

### Required accounts and access

- [ ] Domain owner and final staging hostname.
- [ ] Cloudflare account/zone role with DNS edit access and MFA.
- [ ] Vercel team/project role for the teammate's real frontend repository and
      its staging environment.
- [ ] DigitalOcean team/project with billing approval, MFA, least-privilege
      roles, and named break-glass owner.
- [ ] Private DigitalOcean Container Registry and an expiring push credential.
- [ ] Paystack account with test-mode credentials only.
- [ ] Monnify account with sandbox API key, secret, contract code, and webhook access only.
- [ ] Approved staging secret inventory/manager and two operational reviewers.

### Required DigitalOcean resources

- [ ] App Platform app: `allied-autotech-staging`.
- [ ] API component size and monthly ceiling.
- [ ] Identity-worker and general-worker sizes, replica counts, and monthly ceiling.
- [ ] `PRE_DEPLOY` migration job size.
- [ ] Separate Standard Edition Managed PostgreSQL 17 cluster, database/user,
      backup policy, maintenance window, trusted sources, and restore-test
      owner.
- [ ] Private staging-only Spaces bucket, region, limited access key, retention
      policy, and deletion owner.
- [ ] Alert notification recipients and central log destination.

### Decisions still needed

- Exact root domain and `staging.<domain>` hostname.
- DigitalOcean project, region, registry name, component sizes, and budget.
- Managed PostgreSQL cluster/database/user names and plan.
- Spaces region/bucket name and access-key owner.
- Stable DigitalOcean App Platform origin used by Vercel's rewrite.
- Teammate's frontend framework, existing Vercel routing precedence, and
  responsible reviewer.
- Paystack test and Monnify sandbox credential owners. Provider webhooks must be sent
  directly to the stable DigitalOcean origin when payment testing is enabled.
- Central logging/alert provider and on-call recipients.
- Verified Resend staging sender, recipient allowlist, and delivery-test owner.
- Whether optional Termii SMS is included in this staging cycle; keep it disabled otherwise.
- Approval of the synthetic branch/service fixture labels and illustrative
  values.
- Owner decisions tracked in `owner-decision-checklist.md`, especially delivery,
  cancellation/refund, tax/invoice, dispute, support SLA, and retention rules.

## References

- [DigitalOcean App Spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [DigitalOcean App Platform environment variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)
- [DigitalOcean container image deployment](https://docs.digitalocean.com/products/app-platform/how-to/deploy-from-container-images/)
- [DigitalOcean Container Registry quickstart](https://docs.digitalocean.com/products/container-registry/getting-started/quickstart/)
- [DigitalOcean PostgreSQL TLS and trusted sources](https://docs.digitalocean.com/products/databases/postgresql/how-to/secure/)
- [DigitalOcean Spaces with AWS SDKs](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/)
- [Vercel external rewrites and caching](https://vercel.com/docs/routing/rewrites)
