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
- Active deployment: `f18e29ee-4c53-4c4f-91cd-6008ccf1445b`, following the
  approved monitored-inbox routing alignment. Its four image digests still match
  source/image commit `7acb19e1d6e505cb14abdf82674d6aa654e1c51b`.
- Backend default ingress:
  `https://allied-autotech-production-7jw94.ondigitalocean.app`.
- Backend hostname: `https://api.alliedautotech.com`, ACTIVE. DNS, strict HTTPS
  hostname verification and readiness passed. Certificate expires 20 January 2027. Vercel Production now uses this address as `BACKEND_ORIGIN`.
- Vercel deployment: `dpl_FvauJmGHUenbBtHfwibnVtjvguMw`, READY, Production
  environment, existing Pro project `allied-autotech`. Its source commit is
  `f32b529` (documentation changes after the unchanged application source).
- Private frontend alias: `https://allied-autotech-drab.vercel.app`.
- Root DNS has both recommended Vercel A records, and www has its recommended
  DNS-only CNAME. Authoritative DNS and Vercel configuration checks passed.
  `https://www.alliedautotech.com/login` redirects to the root login page; the
  configured redirect status is 308.
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
  their signed identity. These checks also passed on the active custom backend
  hostname after its DNS record was saved.
- Through the real hosted Vercel alias, normal requests and caller-forged
  forwarding/proof requests all returned 200 with the actual caller's partition.
  The frontend replaced untrusted claims. Internal proof/request headers were
  absent from browser-visible response headers. The server-only signing key
  remains separate from application encryption keys.
- Following the custom-origin frontend redeploy, these browser checks passed
  again on both the Vercel alias and `https://alliedautotech.com`. The root login
  page returned 200 after private access, without a Vercel SSO redirect. A separate
  browser context with only its private-access cookie and no Basic credentials
  reached login, reloaded and opened a new tab successfully (all 200). The cookie
  is host-only, Secure, HttpOnly, SameSite=Lax and valid for eight hours.
- Canonical registration renders on mobile; login renders on desktop. The root
  response includes CSP, private/no-store caching and `noindex, nofollow`;
  robots.txt disallows all crawling and advertises no sitemap. CORS preflight
  allows the exact root origin with credentials (204), and rejects an unrelated
  origin (403). Authenticated CSRF and uploads still await the owner account.
  An initial exploratory GET to `/auth/csrf` returned 404: the actual contract
  is authenticated POST, so that GET was not counted as a CSRF acceptance check.
- Edge browser checks at 1440×1000 and 390×844 confirmed page identity, meaningful
  rendering, homepage-to-services navigation and the contact anchor interaction.
  `/dashboard/cart` redirected to `/contact#enquiry`. Mobile document width matched
  the viewport; no framework error overlay appeared. Screenshots were inspected.
  Browser plugin was unavailable; installed Playwright CLI was used.
- Guest session probes returned the expected 401 and appeared in the browser
  console. One unused image preload warning appeared after client navigation.
  There were no observed framework crashes. This is not a claim of a completely
  empty console or coverage of all authenticated workflows.
  Canonical login/register additionally produced unused font preload warnings;
  no application errors were observed on those final page checks.
- Production inventory at the post-MFA read-only check: zero branches, services,
  products and vehicle listings. No invented products, vehicles or business data
  were inserted to make the launch look populated. Enquiry routing needs an
  active branch; the owner subsequently created the approved Port Harcourt
  workshop through the existing authenticated dashboard. A public API check
  confirmed one active branch with the expected street, city, timezone and
  public contact details. No appointment slots or capacity were created.
- General and sales routing initially used info@ and sales@. The owner's approved
  monitored enquiry contact is support@, so all three production department
  routes now use `support@alliedautotech.com`. Active deployment and readiness
  passed, with component sizes, images, existing secrets, private access and
  disabled payments preserved. Thirty-two deployment-spec checks passed,
  including rejection of an unreviewed recipient. No application image rebuild
  or schema change was necessary for this configuration-only update. On
  22 October 2026, the owner confirmed that a message from another controlled
  email account reached Support and that the reply arrived at that account
  from `support@alliedautotech.com`. This is human acceptance evidence for
  external receiving and branded replying. Delivery and handling of a
  website-submitted enquiry still need end-to-end confirmation.
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
and authenticated canonical-host checks. The owner's Support mailbox acceptance
is recorded above. Production website enquiry alerts and fresh email-header
alignment still need separate confirmation; startup logs and earlier staging
tests do not certify them.

## Required before public access

1. DNS, HTTPS, root/www routing and read-only forwarding checks are complete.
   Keep the access gate while verifying authenticated canonical-host APIs,
   CSRF and uploads; guest page/read checks do not certify those workflows.
2. Production owner `alliedautotechltd@gmail.com` is provisioned. Its normal
   registration/email verification and initial zero-owner state were inspected;
   the existing guarded function created the sole owner role. A separate
   migration-account `db:check` and fresh dedicated-role verified backup preceded
   the change. Post-change checks confirmed the selected active/verified owner,
   zero unrevoked sessions and one provisioning audit entry. Temporary operator
   access was removed and the original app-only firewall verified. See
   [the owner record](initial-owner-provisioning.md). The owner subsequently
   confirmed MFA and admin-dashboard access. Read-only verification confirmed
   an active verified MFA factor and current MFA-verified session, with the
   app-only firewall restored afterward. The owner subsequently confirmed
   authenticated branch creation, and the resulting public branch was verified.
   Upload workflows remain to be verified separately.
3. The selected owner confirmed production email verification, and database
   inspection confirmed the resulting verification state. Fresh email header
   alignment remains to be checked; staging DMARC evidence is not silently
   treated as a new production receipt. Support receiving and branded replying
   passed the owner-operated external-account check on 22 October 2026.
4. Obtain real owner-approved catalogue data/media. The 14 proposed service names
   remain a review proposal, not published records or approved prices.
5. Complete the website enquiry acceptance check with an owner-controlled
   recipient: submission acknowledgement/reference, saved enquiry, Support
   email alert, and a branded reply addressed to the submitted customer email.
   The standalone Support receiving/replying check has passed; it does not
   certify the website-to-worker-to-mailbox path or alert Reply-To handling.
6. Complete the exact public privacy notice, retention rules and international
   processing safeguards. The approved data-handling instructions alone do not
   complete that review. Ordinary closed enquiries have an approved 12-month
   draft rule; automatic deletion remains disabled. See
   [policy decisions](public-launch-policy-decisions.md) and the
   [prepared enquiry wording](public-enquiry-privacy-review.md).
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
