# DigitalOcean staging release

This is the executable release companion to [the owner runbook](owner-staging-runbook.md).
The frontend stays on Vercel. Backend Docker context is `backend`; no buildpack
or repository-root npm workspace is involved. This procedure does not enable
live payments, email, SMS, Monnify, marketing or destructive retention.

## Account access and inventory

The verified portable Windows CLI location on this workstation is:

```powershell
$doctl = Join-Path $env:LOCALAPPDATA 'AlliedAutoTech/tools/doctl/doctl.exe'
& $doctl auth init --context allied-autotech-staging
cd C:\Users\PC\Desktop\allied-autotech\backend
.\scripts\deployment\release.ps1 preflight
```

Enter the token in the interactive terminal, not chat or a repository file.
Alternatively install doctl from [its official release](https://github.com/digitalocean/doctl/releases)
and verify the published checksum. The wrapper also accepts a CLI on PATH or
`AAT_DOCTL`; `AAT_DO_CONTEXT` overrides the named staging context.

Preflight checks Docker, Git and authenticated account access, then prints only
resource names/IDs for projects, registries, apps, databases and VPCs. It does not
print database credentials or full app specs. Inspect Spaces in the control panel
with an authorized account. Reuse the appropriate project and resources. A
possible registry name is `allied-autotech`, subject to account availability;
never use it as an actual registry until confirmed. Four repositories may require
a registry plan above the one-repository tier. Check the account's actual limits.

If resources do not exist, identify their region, plan and cost before creating
the registry, managed database or private Space. The script does not purchase
them. Use [the database role procedure](../ops/postgres/README.md), restrict
Trusted Sources, verify connection capacity/backups, and download the actual CA.

## Private inputs and stable keys

```powershell
.\scripts\deployment\release.ps1 init
```

Edit `ops/digitalocean/.private/inputs.json` locally using actual resource values.
The helper verifies this folder is ignored and untracked, restricts its Windows
ACL to the current user and SYSTEM (0700/0600 on POSIX), and refuses to overwrite
files. Do not put populated values into `inputs.example.json` or the template.
Keep the working copy on an encrypted local disk and never upload it to tickets.

Set the actual App Platform region slug, existing registry and database cluster
name. The database port must come from the provider. Runtime and migration roles
and passwords must differ. Do not paste credentials into command arguments.

Convert the downloaded CA directly into the private input without displaying it:

```powershell
$inputPath = Resolve-Path 'ops/digitalocean/.private/inputs.json'
$deploymentInput = Get-Content -LiteralPath $inputPath -Raw | ConvertFrom-Json
$deploymentInput.values.DB_SSL_CA_BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\downloaded-ca.crt'))
[IO.File]::WriteAllText($inputPath, ($deploymentInput | ConvertTo-Json -Depth 10))
Remove-Variable deploymentInput
```

For a **new staging environment only**, when no stable keys already exist:

```powershell
.\scripts\deployment\release.ps1 keys
```

This creates four independent 32-byte Base64 values in private `keys.json`, prints
no values and refuses regeneration over an existing file. If staging already has
keys, securely supply those existing four values under `TOKEN_HASH_KEY`,
`MFA_ENCRYPTION_KEY`, `OUTBOX_ENCRYPTION_KEY`, `ASSET_TICKET_KEY` instead. Back them
up in a secret manager. Never rotate them merely to redeploy. IDs stay at the
reviewed `staging-...-v1` labels. Production must have different keys.

Initial provider inputs required by the actual parser: a Paystack **test** secret
and private Spaces credentials. Resend/Termii credentials stay blank, email/SMS
disabled, and Monnify disabled. Empty messaging allowlists deny all recipients.
Revoke/rotate the Resend key found in Git history before using Resend again; the
scanner does not revoke keys or erase history. Verify `notify.alliedautotech.com`
using only Resend's exact DNS records before enabling the future sender
`no-reply@notify.alliedautotech.com` for consenting allowlisted testers.

## Build, push and immutable images

First run checks, review changes and commit the intended backend release. The
helper builds all four Linux/amd64 targets and records the full Git SHA and local
image IDs in private `build.json`. Dirty builds are allowed only for local
verification; **push refuses them**. No database connection is used for building.

```powershell
node --test scripts/deployment/spec.test.mjs
node --test scripts/deployment/postgres.test.mjs
npm run lint
npm run check:secrets
.\scripts\deployment\release.ps1 build
node --test scripts/deployment/images.test.mjs
.\scripts\deployment\release.ps1 push
```

Push authenticates Docker to the verified existing registry with credentials
that expire after one hour. It checks the source commit and local image IDs,
then pushes these repositories, each tagged with that full SHA:

| Target | Repository | Container command |
| --- | --- | --- |
| `api` | `allied-autotech-api` | `node dist/server.js` |
| `worker` | `allied-autotech-identity-worker` | `node dist/workers/outbox.worker.js` |
| `general-worker` | `allied-autotech-general-worker` | `node dist/workers/worker-runtime.js` |
| `migrate` | `allied-autotech-migrate` | `node node_modules/prisma/build/index.js migrate deploy` |

The PostgreSQL test creates and removes its own isolated Docker container with
no host ports or mounted application data. Image tests exercise the actual CA
entrypoint, permissions and secret removal without connecting to a database.
The root `.gitattributes` forces LF for Linux shell entrypoints on Windows;
the clean-tree guard includes that file. A successful build alone will not detect
a broken CRLF shebang, so run the image tests before pushing.

The actual registry format is `registry.digitalocean.com/REGISTRY/REPOSITORY:SHA`.
Registry manifest digests are recorded in private `release.json` and displayed;
local configuration IDs are not substituted for pushed digests. A partial failure
stops before generating a spec. After correcting it, rerunning push is safe for
the same reviewed images. Never reuse a commit tag for different source content.

For subsequent releases, move the old `build.json`, `release.json` and populated
spec into an archive **inside the protected private folder**. Preserve inputs
and keys. The helper deliberately refuses to silently overwrite release evidence.
Do not edit the checkout during a release build or push.

## Spec validation and application

```powershell
.\scripts\deployment\release.ps1 spec
.\scripts\deployment\release.ps1 validate
```

This fills the existing JSON-as-YAML template, pins the four pushed digests,
attaches the existing managed cluster and keeps the reviewed environment scopes.
Only missing values can be supplied; generic security overrides are rejected.
API and both workers start with one 1-GiB instance each
(`apps-s-1vcpu-1gb-fixed`); the migration job uses the same size only while running.
Check current regional availability and [App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/)
before submission. The database attachment's `production: true` means a managed
database rather than a dev database; application `DEPLOYMENT_ENV` remains staging.

Generated specs contain plaintext initial secrets **inside an ignored protected
file**; `type: SECRET` instructs DigitalOcean to encrypt them on submission, not
locally. Prefer retaining DigitalOcean's returned encrypted values for later
manual spec edits. Do not print or commit full exported specs, and never copy
encrypted values between applications. Validation captures provider output to
avoid echoing secrets; on failure inspect field names in the private control panel.
The [App Spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
defines image digests, PRE_DEPLOY jobs, health checks and managed DB attachments.

Once the actual project/resources and cost have been reviewed, create the app:

```powershell
& $doctl --context allied-autotech-staging apps create --spec ops/digitalocean/.private/staging.app.yaml --project-id ACTUAL_PROJECT_ID --format ID,DefaultIngress --wait
```

For an existing app, verify its ID/name is exactly the intended staging app and
update that ID explicitly instead of using an upsert that could target another
resource:

```powershell
& $doctl --context allied-autotech-staging apps update ACTUAL_STAGING_APP_ID --spec ops/digitalocean/.private/staging.app.yaml --update-sources --format ID,DefaultIngress --wait
```

The explicit source update retrieves the reviewed digest-pinned images. Preserve
the existing app's encrypted secrets when editing in the control panel. Do not
reset the database or run migrations manually alongside PRE_DEPLOY. A failed
migration must block the release; inspect the migration deployment logs privately.

Keep the create/update process attached and inspect its exit status. If observation
times out, inspect the same app/deployment rather than creating another app.
Verify the PRE_DEPLOY result, service health and both worker heartbeats before
calling the app usable. Startup probes alone do not validate business workflows.

## Spaces and provider checks

Create/reuse a private bucket (suggested name `allied-autotech-staging-private`,
subject to availability). Disable public listing/CDN exposure and issue bucket-
scoped read/write credentials. API alone receives these credentials. Keep the
endpoint regional, `OBJECT_STORAGE_REGION=us-east-1`, path-style false.

Apply [spaces-cors.json](../ops/digitalocean/spaces-cors.json) using the Spaces
control panel or S3 API. It permits only the actual staging frontend and the
PUT/GET/HEAD methods, content type, checksum and encryption headers used by the
existing adapter. Do not add wildcard origins or credentials. CORS does not grant
object access. Verify the provider accepts the existing SHA256 checksum/AES256
upload contract, completion HEAD metadata, private unsigned denial and signed
download expiry with a disposable test object. Until exercised against Spaces,
provider compatibility is unverified; never remove integrity checks to force it.

Paystack webhook is `/api/v1/webhooks/paystack` with raw-body HMAC SHA512 and
server-side verification. Its frontend redirect is `/payments/complete`; that
redirect does not prove payment. Exercise only safe test transactions, including
amount/reference mismatch and replay. Leave `PAYSTACK_LIVE_ENABLED=false`.

## Domain and Vercel

First obtain the healthy application's **actual** default ingress from
DigitalOcean. Add `api-staging.alliedautotech.com` to the app, then use exactly
the target and verification records DigitalOcean supplies in Cloudflare. Initial
proxy status is **DNS only**, TTL Auto. Do not invent the target or an origin IP.
There is no ready-to-apply DNS record until DigitalOcean supplies that target.

After TLS and health work on the custom domain, set the Vercel environment serving
the staging frontend to:

```dotenv
BACKEND_ORIGIN=https://api-staging.alliedautotech.com
```

Redeploy the frontend so Next.js rebuilds the rewrite. Do not add
`NEXT_PUBLIC_API_URL`; browser requests remain relative `/api/v1/...`. Verified
frontend routes include `/verify-email`, `/reset-password`,
`/staff/accept-invitation`, and `/payments/complete`. WebAuthn RP ID is
`staging.alliedautotech.com`, never the API host.

Keep `TRUST_PROXY_HOPS=0`, empty `TRUST_PROXY_CIDRS` and the existing rate limits
until actual forwarding behavior is measured. Test forged headers through the
default hostname and custom domain, determine the real proxy chain, then configure
only supported narrow trust. Do not enable Cloudflare proxying before validating
origin TLS, rate limiting, alternate-host restrictions and webhook access.

## Acceptance evidence

Record each item in [the release record](../ops/digitalocean/release-record.template.md):

- Four build/push digests, commit, app/deployment IDs and migration success.
- `GET /api/v1/health/live` and `/api/v1/health/ready` succeed over valid HTTPS.
- Both workers start, persist recent heartbeats and shut down cleanly. Inspect
  authenticated `/api/v1/admin/operations/status`; workers have no public ports.
- Runtime DB role passes DML tests and fails DDL/ownership/role-admin tests;
  Prisma uses migration credentials, the real CA and strict hostname validation.
- Wrong CA and wrong hostname fail in a disposable TLS test. Local tests do not
  prove cloud TLS; run `npm run check:db-tls` with actual protected runtime inputs.
- Frontend authentication/session/CSRF, WebAuthn origin and CORS remain enforced.
- Private storage signed upload/metadata/download, unauthorized access and expiry
  pass against the actual staging bucket.
- Only Paystack test transactions; provider messaging remains disabled until
  verification and explicit recipient allowlists. Termii/Monnify are not blockers.
- Docs remain disabled, no default admin password or arbitrary super-admin
  bootstrap, no live charging, no wildcard proxy/CORS or public database access.

Use isolated fixtures for mutations. Cloud health, migrations, permissions,
storage and provider settlement remain **untested** until their actual resources
and credentials are available; local builds do not establish those outcomes.
