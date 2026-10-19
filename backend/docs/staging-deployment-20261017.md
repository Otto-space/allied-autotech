# Private staging deployment — 17 October 2026

The backend and connected Vercel frontend are active for private testing as of 19 October 2026. Read-only hosted browser checks passed; authenticated customer/staff workflows still require verified staging accounts. This record contains no credentials.

- Backend: https://allied-autotech-staging-825no.ondigitalocean.app
- Active backend deployment: `4bd5e10f-a02d-4cab-ab43-8608dc2e34ed`
- Frontend: https://allied-autotech-staging-5ae8fa4d.vercel.app
- Active frontend deployment: `dpl_GdFDNkZoXwBrV9zUcYEXQp3XWhMW`
- Private gate username: `allied-test`. Its password is stored only in the ignored, ACL-restricted `backend/ops/digitalocean/.private/private-access.json`; do not paste it into chat or commit it.
- The private gate is separate from customer/staff application login. No owner account or customer data was imported into staging.

## Authorization

- Approved DigitalOcean recurring baseline: **$45.15/month**, before applicable taxes and usage overages. Ask before additional costs or purchases.
- Approved separate managed restore rehearsal: **up to $1**, including removal of `allied-autotech-staging-restore-20261017` after verification.
- Frontend remains on Vercel. On 19 October the user confirmed their Pro upgrade; the API verified Pro. A branch-scoped private Preview was deployed. No subscription was purchased by the deployment agent and production was not promoted.
- Public access and live payments remain disabled. No business policies are published by this deployment.

## Provisioned resources

| Resource                                                    | Identifier                                                           | Baseline     |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ------------ |
| Managed PostgreSQL 18, London, 1 GiB, 10 GiB disk, one node | `allied-autotech-staging-db`; `fa393215-a10f-4c52-9a83-7b9e8b52af1b` | $15.15/month |
| Container Registry Basic, London                            | `allied-autotech-staging-5ae8fa4d`                                   | $5/month     |
| Private Spaces bucket, London                               | `allied-autotech-staging-5ae8fa4d`                                   | $5/month     |

The approved App Platform API (one 1 GiB instance) and two workers (one 512 MiB instance each) are active as `allied-autotech-staging` (`e06d8cea-250f-4f26-ac09-78d02c3d5b57`), adding $20/month for the approved **$45.15/month** combined baseline. No additional recurring resources or Vercel subscription were purchased.

The approved temporary restore cluster `allied-autotech-staging-restore-20261017` (`cbb577ec-328c-471f-ae1b-4597da5e358f`) successfully restored the source at `2026-10-17T19:45:02.969Z`. All 59 migration checksums and counts for 83 tables matched, restored runtime privileges passed, strict TLS passed, and the packaged `npm run db:check` completed successfully. The temporary cluster was deleted at `2026-10-17T19:58:57.130Z`, with provider 404 confirmation and the source still online. Its lifetime was about 13.5 minutes: approximately $0.0051 prorated, or $0.02254 conservatively rounded to one hour, before applicable taxes. This is an estimate, not a final invoice, and is within the separately approved $1 cap.

The newly created `allied_autotech_staging` database now contains all **59 committed migrations**, applied through the guarded `npm run db:migrate` runner after a fresh verified backup. The subsequent schema/history check passed. No local application data was copied. Three independent login roles were created for runtime, migration and backup. Their administrator, role creation, database creation, replication and RLS-bypass attributes are false, and they have no inherited role memberships. Reviewed object grants and backup SELECT defaults were applied. Runtime database/schema CREATE, table ownership, TRUNCATE and migration-ledger UPDATE checks all returned false. Required `citext` and `pg_trgm` extensions were installed by the operator before migrations.

Strict TLS was verified using the CA downloaded by the user. DigitalOcean's CA API returned an empty certificate. After verification, the temporary runner IPv4 was removed: Trusted Sources now contains only the exact App Platform app ID. Hosted database readiness still returned 200 after this restriction. Future operator access requires temporarily adding the operator's exact current IP, then removing it again; never allow all addresses.

Spaces passed a synthetic write/read/delete round trip, and anonymous access returned 403. Only the newly created probe object was deleted. The temporary account-wide provisioning key was revoked; the runtime key is restricted to this bucket. As of 19 October, bucket CORS permits `https://allied-autotech-staging-5ae8fa4d.vercel.app` and `https://staging.alliedautotech.com`. The latter remains a planned domain without DNS changes. A separate temporary administrative key used for the CORS update was revoked after read-back verification.

## Release and verification

An isolated worktree preserves the user's active working directory:

- Branch: `deploy/private-testing-20261017`
- Image source commit: `f50f0a67249b4e05442ea224e12e0f155b03042e`
- Deployment command correction commit: `e386be9d550fca33f5d766973abfda6a3f830358`
- Worktree: `C:/Users/PC/.codex/worktrees/allied-hosting-20261017`
- Backend secret scan, TypeScript and scripts type checks passed.
- Backend unit suite: **314 tests passed**, after correcting a stale API operation count and limiting worker concurrency.
- Deployment-spec checks: **19 passed**, including disabled payments and live-key rejection.
- Built-image checks: **9 passed**. These include non-root entrypoints, CA handling, Sharp, application imports, isolated migration replay, migration-history/schema checks, pending/drift rejection, and an actual separate **local** restore.
- Frontend private-access unit checks: **16 passed**.
- Built frontend gate check passed for anonymous requests, wrong credentials, prefetch, API rewrites, server-rendered reads, image optimization/cache, and absence of the secret in returned HTML/headers. This was a local network-isolated test, not a hosted frontend test.
- Four backend images built and uploaded to the private registry. The populated, digest-pinned App Spec passed DigitalOcean validation. Managed recovery verification and App Platform rollout passed.

The initial deployment `f68fffec-2856-4b01-8eef-50fcb1858378` failed in the read-only PRE_DEPLOY check because App Platform's custom run command bypassed the container entrypoint that creates the CA file. No database repair was performed. The corrected command explicitly invokes `aat-with-database-ca`; 28 deployment specification/container checks passed, including a regression test reproducing the entrypoint override. The same immutable images and resource sizes were redeployed. The hosted PRE_DEPLOY job then confirmed all 59 migrations and no schema difference, without changing the database.

Hosted verification passed:

- Liveness and database readiness: HTTP 200.
- Anonymous catalogue, session and admin requests: HTTP 401.
- Incorrect private-gate credentials: HTTP 401.
- Correct private-gate credentials: catalogue HTTP 200; session still requires application authentication (HTTP 401 without a session).
- All eight checked responses included `private, no-store` and `noindex, nofollow`; none contained the private-gate password.
- Both worker startup logs were present. A read-only query using the backup role found eight successful worker task heartbeats, 0–27 seconds old relative to database time, with no recorded failures or error codes.
- Final resource inventory contained only the source database, online; the restore cluster was absent. App sizes, counts, image digests and disabled payment/messaging flags matched the approved specification.

These are deployment and read-only smoke checks, not a load test or a hosted customer workflow test. Hosted media upload, customer login, checkout and complete authenticated browser workflows remain to be tested after verified staging accounts are available. The backend address is an API endpoint, not the customer dashboard. Generic health endpoints remain reachable without the private password; business routes require it. Normal application authentication and permissions still apply behind the gate.

| Image               | Pushed digest                                                             |
| ------------------- | ------------------------------------------------------------------------- |
| API                 | `sha256:bd15fdb25ef69b180aca77239998f73743938498d4b127b732f2d1c92d412b3c` |
| Identity worker     | `sha256:baaa44325ef91be8189ae9475993427cb2e6e50e798af360d3f0f6dfc0193b1b` |
| General worker      | `sha256:19785d67626b6e4c4b2799080d326640f89f31b2199e6dbcea77c1eac98c9ea5` |
| Migration/check job | `sha256:aaa8a799d2c779ee9a1767fb8b2f464dbb417d935e88539c00a6e51f4f8f2279` |

Payments are fully disabled because no Paystack test key is configured. Live Paystack/Monnify, email and SMS delivery remain disabled. Application encryption keys are preserved. Owner credentials will never be supplied to the API or workers.

## Backups and remaining gates

The provider API confirmed automatic managed backups on 17, 18 and 19 October; the latest checked backup was created at `2026-10-19T05:22:08Z`. DigitalOcean documents [daily backups with seven-day PITR](https://docs.digitalocean.com/products/databases/postgresql/details/features/), [off-site encrypted managed backups](https://www.digitalocean.com/security), and [backup key encryption](https://www.digitalocean.com/security/shared-responsibility-model-managed-databases).

A fresh local custom-format backup was created with the dedicated backup role and strict TLS. Its archive target and SHA-256 receipt were verified, and it is stored outside both repositories with a restricted Windows ACL. Recovery was separately verified through the completed managed restore rehearsal described above; an archive index alone was not treated as recovery proof.

Remaining sequence:

1. Completed: owner credential supplied locally, reviewed permissions/extensions applied, fresh backup verified, 59 guarded migrations and schema/history checks passed. No password was changed.
2. Completed: managed restore, checksum/count/privilege comparison, strict TLS and schema check; temporary cluster removed and deletion confirmed. Source and backups preserved.
3. Completed: validated App Spec deployed with private access and disabled payments; read-only PRE_DEPLOY history/schema checks passed. Database Trusted Sources now allows only the exact App ID.
4. Completed: hosted readiness, anonymous/wrong-password denial, authenticated catalogue access, worker health and provisioned resource configuration verified. Sustained resource utilization and capacity testing have not been performed.
5. Completed on 19 October: Pro confirmed, private Preview deployed, exact frontend origins applied to API/workers and Spaces, and read-only browser checks passed.
6. Remaining: verified staging owner/test accounts, authenticated dashboard/MFA/upload tests and approved catalogue test data. Custom staging DNS, messaging and payment activation are not part of this completed connection.

Private evidence resides in the ignored, ACL-restricted `backend/ops/digitalocean/.private` directories. Do not commit, upload or paste their contents. Local backup receipts expire after one hour; refresh before migrations when required.

## Frontend connection preparation - historical, 17 October

The following records the initial preparation; the 19 October completion below supersedes its pending items.

After the backend handoff, the user authorized all connection preparation within
the existing purchasing limits. Vercel was rechecked: the existing project still
uses Hobby, and no upgrade or hosted frontend deployment was made.

Seven private-preview environment values are prepared in the protected
`frontend-private-testing.env` and `vercel-preview-env-payload.json` evidence files.
Vercel rejected branch-specific creation because the release branch has not been
published to the connected Git repository. A follow-up read confirmed the hosted
environment variables were unchanged. The preparation branch now has a checked-in
automatic Git deployment guard so it can be published before its sensitive Preview
settings are saved, once the hosting plan is resolved.

A local production frontend image was built against the real DigitalOcean API
using a BuildKit secret mount. The connected read-only smoke test passed: anonymous
and incorrect-password denial, API readiness, real frontend-to-API rewrites,
separate application authentication, login and server-rendered service pages,
storage CSP, and secret absence in returned HTML/headers and 250 public assets.
It created no application records and removed its temporary container. Script
syntax, targeted ESLint and formatting checks passed.

The actual private frontend origin, corresponding backend authentication/link
settings and Spaces CORS still need finalization at deployment. The runtime Spaces
key returned 403 for bucket-CORS inspection; this correctly keeps administrative
bucket configuration outside runtime permissions. No key scope was widened.
Email, SMS and payments remain disabled. See the prepared values, exact remaining
steps and verification command in the
[frontend deployment guide](../../frontend/docs/vercel-deployment.md#connected-private-preview---19-october-2026).

## Frontend connection completed - 19 October 2026

The released frontend source is commit `8d12e25ed3139a5e1e1c083502299cd74d15322b`
on `deploy/private-testing-20261017`. Seven branch-specific Preview variables are
saved and present in the final Git-sourced Vercel deployment at build and runtime.
The stable preview alias points to `dpl_GdFDNkZoXwBrV9zUcYEXQp3XWhMW`.
The earlier local-upload candidate lacked branch variables and was superseded;
Vercel's existing sign-in protection remained in force throughout.

The backend rollout changed only reviewed frontend/WebAuthn/link settings; image
digests, component sizes, private credentials and disabled integrations were
preserved. It is active as `4bd5e10f-a02d-4cab-ab43-8608dc2e34ed`.
No database migration, grant modification, data import or account creation was
performed. No additional infrastructure was purchased. The existing successful
managed restore rehearsal was not repeated for this configuration-only rollout.
The fresh daily managed-backup inventory was checked read-only.

Chrome checks on the stable frontend returned 200 for services and login, 200 for
the catalogue API with private access, and 401 for application session without
login. Missing and incorrect private credentials returned 401 on page and API
routes, with the private gate challenge. Checked responses had noindex/no-store
headers; the service page rendered its empty hosted catalogue and brand images,
and its CSP allowed the configured Spaces hostname. Expected unauthenticated
session requests returned 401; the verification browser intentionally blocked
Vercel's optional external feedback script. This was not a mutation/load test.

The CORS administrative Spaces key and Vercel automation bypass were both revoked.
Vercel production remained `dpl_HGgU9YQ28xdj8VTzdHTkPrJQsppf`; its variables and
project-wide sign-in protection were preserved. Email, SMS and payments remain
disabled. See the [frontend guide](../../frontend/docs/vercel-deployment.md) for
private access instructions, remaining account setup and repeat deployment steps.
