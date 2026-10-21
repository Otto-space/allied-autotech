# Production prelaunch record — 22 October 2026

Status: **deployed and privately gated; public launch is not complete**.
Approved scope is browsing and enquiries. Checkout, paid reservations and live
payments remain unavailable. This record contains no credentials.

## Deployed release

- Source/image commit: `7acb19e1d6e505cb14abdf82674d6aa654e1c51b`, on
  `deploy/public-browse-20261021`, based on the stable staging source. The newer
  workforce branch is excluded.
- DigitalOcean app: `allied-autotech-production`, ID
  `6b13a247-a3b2-4354-9b9c-dedc185324f8`.
- Active deployment: `371519cb-50e4-474d-81b2-d9d77d60c3cc`.
- Backend default ingress:
  `https://allied-autotech-production-7jw94.ondigitalocean.app`.
- Intended backend hostname: `https://api.alliedautotech.com`; DNS/TLS verification
  is outstanding. The frontend currently uses the working default ingress.
- Vercel deployment: `dpl_ETwqNnArA6JAXmpKMUmtrCETh6oj`, READY, Production
  environment, existing Pro project `allied-autotech`.
- Private frontend alias: `https://allied-autotech-drab.vercel.app`.
- Root and www domains are assigned to this deployment; www has a configured
  308 redirect to `alliedautotech.com`. Public DNS cutover remains outstanding.
- Both layers retain private access. Frontend indexing remains disabled. Normal
  account authentication and MFA remain separate from the outer access gate.

## Resource allocation

Staging app `e06d8cea-250f-4f26-ac09-78d02c3d5b57` is confirmed archived in both
its saved spec and active deployment. Its database and data are preserved.
Production reuses the existing managed server, Registry and Spaces subscription,
with its own database, restricted roles, private bucket and secrets.

Persistent app capacity remains API USD10/month and two workers USD5/month each.
The DigitalOcean baseline remains approximately USD45.15/month; existing
one-seat Vercel Pro brings it to approximately USD65.15/month, before taxes,
deployment-job runtime and overages. DigitalOcean's proposal displays USD30 for
the app spec because it includes the USD10 size rate of the short-lived predeploy
job; persistent services/workers total USD20. The predeploy job remains a read-only
database check. No second persistent database server or new subscription was bought.

Registry usage observed after this release: 568,833,024 bytes, within Basic's
existing allowance. The separately approved temporary managed restore cluster
was deleted and its absence verified; actual usage billing remains subject to
the provider's invoice and the approved USD1 cap.

## Completed checks and their limits

- Production initial-migration recovery followed the separately approved
  [reviewed recovery](production-initial-migration-recovery.md). All 59 migrations
  completed through the guarded runner; final `db:check`, runtime/backup role
  privilege checks and a fresh post-migration backup passed. No existing database
  was reset, replaced or restored over. Operator public firewall access was removed.
- Initial-failure recovery was first rehearsed on new isolated `_ci` databases,
  including a real dump restore into a second isolated database and `db:check`.
- Managed PITR was restored into a separate temporary server over strict TLS.
  Counts and migration-ledger digests matched staging (83 tables, 59 migration
  records) and production's then-failed initial state. This rehearsal preceded
  production recovery; it is not a claim that the final migrated production
  snapshot was itself restored. The temporary server was removed afterward.
- The new deployment's predeploy database check completed successfully. API
  readiness returned 200, and both worker startup logs contained no errors at
  inspection. Startup checks do not prove end-to-end email processing.
- Unauthenticated backend catalogue access returned 401. Authorised access
  returned 200. Checkout writes returned 403 with the launch-mode rejection
  before any cart mutation.
- On the real DigitalOcean default ingress, rate-limit partition matched the
  actual caller. Forged `do-connecting-ip`, XFF and alternate forwarding headers
  did not change it. Invalid signed claims returned 403; valid claims matched
  their signed identity. Custom-hostname verification is still outstanding.
- Through the real hosted Vercel alias, normal requests and caller-forged
  forwarding/proof requests all returned 200 with the actual caller's partition.
  The frontend replaced untrusted claims. Internal proof/request headers were
  absent from browser-visible response headers. The server-only signing key
  remains separate from application encryption keys.
- Edge browser checks at 1440×1000 and 390×844 confirmed page identity, meaningful
  rendering, homepage-to-services navigation and the contact anchor interaction.
  `/dashboard/cart` redirected to `/contact#enquiry`. Mobile document width matched
  the viewport; no framework error overlay appeared. Screenshots were inspected.
  Browser plugin was unavailable; installed Playwright CLI was used.
- Guest session probes returned the expected 401 and appeared in the browser
  console. One unused image preload warning appeared after client navigation.
  There were no observed framework crashes. This is not a claim of a completely
  empty console or coverage of all authenticated workflows.
- Production catalogue responses are empty. No invented products, vehicles or
  business data were inserted to make the launch look populated.
- Frontend `npm audit --omit=dev` reported zero vulnerabilities at inspection.
  The hosted install reported development dependency findings; these were not
  represented as production runtime vulnerabilities or silently auto-fixed.
- Earlier local release checks are recorded in
  [the hosting plan](hosting-approval-plan.md): isolated migration replay,
  backend/API tests, frontend units/build, OpenAPI, lint/type checks and six
  signed-forwarding browser flows. No cloud application database was used as
  a test database.

The production bucket's scoped-key upload/read/delete, private ACL, anonymous
listing rejection and exact-origin CORS preflight passed. Full authenticated
resource attachment/replacement/removal still needs the production owner account
and canonical frontend hostname. Production outbound email receipt and support
receiving/replying have not been certified by startup logs or earlier staging tests.

## Required before public access

1. Add and verify DNS for `api` (CNAME to the default backend ingress, DNS only),
   complete its TLS issuance, and repeat forwarding/spoof checks on that hostname.
2. Recheck Vercel's current DNS recommendations and connect root/www. Keep the
   access gate while verifying canonical-host cookies, APIs, CSP, CSRF and uploads.
3. Register/verify the distinct production owner `alliedautotechltd@gmail.com`,
   complete MFA, then use the guarded bootstrap only after its identity and zero
   existing production owners are verified. Do not copy the staging password or
   bypass normal verification.
4. Obtain real owner-approved catalogue data/media. The 14 proposed service names
   remain a review proposal, not published records or approved prices.
5. Verify receiving and replying through `support@alliedautotech.com` and the
   essential production email path with authorised recipients.
6. Complete the exact public privacy notice, retention rules and international
   processing safeguards. The approved data-handling instructions alone do not
   complete that review. See [policy decisions](public-launch-policy-decisions.md).
7. Review future Vercel automatic deployment: the configured Git production branch
   is currently `master`, while this release was explicitly uploaded from the
   release worktree. Avoid an unrelated branch deploy overwriting this release.
8. After these checks and owner content acceptance, remove only production's
   perimeter gate and enable canonical indexing under the approved browsing and
   enquiry launch. Preserve authentication/MFA and disabled transactions/payments.

Private receipts and logs remain in the ignored operator-only deployment
directory. Never paste their complete contents: provider specs and backup evidence
can contain credentials. Restore or rollback must preserve database compatibility;
an image rollback does not authorise a database downgrade or data replacement.
