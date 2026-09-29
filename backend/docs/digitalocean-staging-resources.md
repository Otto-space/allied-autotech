# Staging resource proposal — 28 September 2026

Authenticated read-only inspection now succeeds using doctl context
`allied-autotech-staging`. No paid resources have been created.

**Current owner instruction:** “Don't make any payment until i say so.” Neither
the original proposal nor the cheaper alternative below is approved. Do not
create paid resources, start billable deployments, or upgrade subscriptions
without explicit subsequent approval. Account authentication is not spending
approval. The owner asked for a cost explanation, not an immediate plan change.

## Lower-cost alternative — proposal only

For light staging use, the same architecture could potentially use a 1-GiB API
($10/month), two 512-MiB workers ($5 each), a 1-GiB managed PostgreSQL node
($15.15), Basic DOCR ($5), and private Spaces ($5): **$45.15/month base**.
Migration-job usage, taxes and overages are additional. Current plan prices are
from the provider sources below and [App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/).

This is not yet a validated capacity recommendation. A 1-GiB database cannot
support the current 36-connection rolling budget: pool limits and deployment
headroom would need explicit sizing and tests. Both workers would also need
representative testing with enforced 512-MiB limits. No pool limits, memory sizes
or deployment templates have been changed to this alternative. Security controls
would remain unchanged. A frontend-only Vercel preview needs no DigitalOcean
resources at all.

## Account inventory

- Project: `first-project`, ID `2df096cb-71da-4aff-821f-86e7b5680d50`, the default
  project. It currently has no attached resources. Reuse it without renaming.
- Registries: none.
- App Platform apps: none.
- Managed databases: none.
- VPCs: none.
- Spaces access keys: none. Bucket inventory is not independently verified
  without Spaces credentials; inspect the control panel before creating a bucket.
- Local environment: no usable Paystack test credential. No real provider values
  have been substituted into private deployment inputs.

## Proposed new resources

Use London consistently: App Platform `lon`, infrastructure `lon1`.
The authenticated API lists London for App Platform, managed PostgreSQL and DOCR;
the [Spaces availability table](https://docs.digitalocean.com/products/spaces/details/availability/)
also lists standard storage there. This is a proposed region, not a measured
latency claim or an existing resource location.

| Resource | Proposed configuration | Monthly base estimate (USD) |
| --- | --- | ---: |
| API | One `apps-s-1vcpu-1gb-fixed` instance | 10.00 |
| Identity worker | One `apps-s-1vcpu-1gb-fixed` instance | 10.00 |
| General worker | One `apps-s-1vcpu-1gb-fixed` instance | 10.00 |
| Managed PostgreSQL | Standard PostgreSQL 17, one `db-s-1vcpu-2gb` node, base storage | 30.45 |
| DOCR | Basic tier, one registry, four repositories | 5.00 |
| Spaces | Standard subscription, private bucket | 5.00 |
| **Base total** | | **70.45** |

The PRE_DEPLOY migration job is additional usage while running; the API reports
`usd_per_second=0.000004133598` for the selected App Platform instance. Taxes,
storage/transfer overages and additional database storage are excluded. Exact
checkout/account pricing takes precedence. The PostgreSQL product documentation
rounds the 2-GiB starting price to $30; the current pricing calculator displays
$30.45, used here. This plan has a single database node, not a standby replica.

Sources: authenticated `apps tier instance-size get` and
`registries options subscription-tiers`, plus [managed database pricing](https://www.digitalocean.com/pricing/managed-databases),
[DOCR pricing](https://docs.digitalocean.com/products/container-registry/details/pricing/)
and [Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/).

The free DOCR tier only allows one repository; this architecture needs four.
Basic allows five repositories and 5 GiB storage. Verify compressed image storage
after push and retain old releases deliberately; do not run automatic destructive
registry cleanup as part of deployment.

## Database capacity

The backend's existing pool budget is 18 connections steady and up to 36 during
rolling overlap. DigitalOcean documents 22 available connections for 1 GiB and
47 for 2 GiB. Thus the 1-GiB plan cannot accommodate the existing overlap budget.
The proposed 2-GiB plan leaves 11 connections beyond the overlap budget for the
migrator/operator reserve; measure actual migration use and `max_connections`
after creation before declaring capacity verified. No pool sizes were reduced to
fit a cheaper plan. [Provider connection limits](https://docs.digitalocean.com/products/databases/postgresql/details/limits/).

## Creation sequence after the resource decision

1. Recheck the inventory to avoid duplicating anything created meanwhile.
2. Create the Basic DOCR registry, suggested name `allied-autotech` subject to
   global availability, in `lon1`. Record the returned name rather than assuming
   success. The verified CLI syntax is:
   `doctl registries create NAME --region lon1 --subscription-tier basic`.
3. Create the staging PostgreSQL cluster, suggested name
   `allied-autotech-staging-db`, in `lon1` with PostgreSQL 17, one
   `db-s-1vcpu-2gb` node. Use captured JSON output: the default DB response can
   contain credentials and must not be printed. Poll the same cluster ID until
   ready. Record actual CA/host/port privately; do not assume a default port.
4. Immediately restrict database Trusted Sources to the required operator IPv4
   and then the App Platform app. Do not add public-all ranges. Create
   `allied_autotech_staging`, dedicated runtime/migration login identities, and
   apply the reviewed role grants over verified TLS. Reuse the provider's default
   regional VPC if one is created; do not invent its UUID.
5. Verify/create a private Space, proposed name
   `allied-autotech-staging-private`, in `lon1`; no CDN or public listing.
   Obtain a bucket-scoped read/write key and apply exact CORS. Store the returned
   access values privately, never in console output or Git.
6. Obtain the actual Paystack test secret locally. Stable application keys are
   now generated once in protected `.private/keys.json`; preserve them.
7. Commit the reviewed release changes, build/test clean images and push all four
   SHA tags. Resolve registry digests, generate the private spec and run full
   provider validation before creating `allied-autotech-staging` in `first-project`.
8. Observe PRE_DEPLOY completion, API readiness and worker health; remove runtime
   access to the first migration ledger before opening business ingress. Then
   exercise strict TLS, role permissions, private storage and Paystack test flows.
9. Obtain the actual App Platform ingress/custom-domain DNS instructions, then
   configure Cloudflare DNS-only and Vercel `BACKEND_ORIGIN` after HTTPS checks.

The resource decision is pending because this account needs new recurring paid
resources and no spending limit was supplied. Authentication is no longer a
blocker. The Paystack test key remains a separate required input for starting the
API/general worker. Resend rotation is required before enabling email; email,
SMS and Monnify stay disabled and do not block initial infrastructure setup.
