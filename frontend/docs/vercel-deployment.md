# Deploy the frontend to Vercel

## Connected private preview - 19 October 2026

The owner upgraded the existing team to Pro. The plan was verified through the
Vercel API, and the private frontend is now deployed and connected to DigitalOcean:

- Frontend: https://allied-autotech-staging-5ae8fa4d.vercel.app
- Backend: https://allied-autotech-staging-825no.ondigitalocean.app
- Vercel deployment: `dpl_A9v1J2s4pN2USSHUxZHhGgBjGbxE`, `READY`.
- Source: `deploy/private-testing-20261017`, commit
  `8ace6e62d647d7f6253b335b1c47205cadf0147e`.
- Backend configuration deployment: `4bd5e10f-a02d-4cab-ab43-8608dc2e34ed`, `ACTIVE`.

The existing project is `allied-autotech` in
`michael-enochs-projects-3da06943`, with root `frontend`, Next.js and Node 24.x.
Production branch `master`, production variables and production deployment
`dpl_HGgU9YQ28xdj8VTzdHTkPrJQsppf` were preserved. No new subscription or
additional DigitalOcean resource was purchased for this connection.

### Open the private site

1. Open the frontend link above. Vercel may first require the project owner's
   Vercel sign-in; its existing deployment protection remains enabled.
2. At the browser's private-testing prompt, enter username `allied-test` and the
   existing password from the local, ignored, ACL-restricted
   `backend/ops/digitalocean/.private/private-access.json`. Never paste that file
   or password into chat, source control, screenshots or public documentation.
3. After successful private entry, a signed, host-only, Secure/HttpOnly cookie
   remembers access for eight hours across tabs and reloads in that browser.
   A different browser/profile, cleared cookies or expired access requires the
   password again. Rotating the shared password invalidates existing cookies.
   This cookie grants no application account permissions.
4. The application's own Sign in page is a separate account login. No hosted
   owner account or local customer/catalogue data has been imported. Empty
   services/products/vehicles therefore do not indicate a failed connection.
5. Staff who cannot pass Vercel protection need an intentionally shared preview
   through Vercel's sharing controls, or the later custom staging domain. Do not
   disable protection project-wide or purchase extra seats as a workaround.

A verified staging account is still needed before the first Super Admin can be
bootstrapped through the reviewed bootstrap script. Email delivery remains
disabled; registration verification and password-reset delivery are not ready.
Do not mark accounts verified manually or bypass normal authentication to test.

## Production rollback guard - 27 October 2026

This section is an operational recovery procedure, not authorization to change
production. The pinned frontend deployment is
`dpl_J5k6BjFUZVTFgeGJSrH4WHhiFxcq`, project `allied-autotech`
(`prj_LbuHFZ0EY8fBQL2pcOP1L3YHK2cb`), scope
`michael-enochs-projects-3da06943`, source branch
`fix/mobile-navigation-current-20261027`, verified source commit
`fbb6565a57e484f802e1317d82f6631c55b34b03`. The site-completion release
record says this deployment reached `READY` and was verified on the apex and
`www` production domains. That record is the last known verification, not a
live-state guarantee. The rollback helper checks project, deployment, source,
readiness and recent production deployment state before presenting a plan.

**Rollback is conditional on Vercel still retaining this deployment and the
Vercel service/API being available.** The helper does not pin or extend
retention, recreate deleted deployments, or guarantee that Vercel will accept
a rollback. Verify the current team plan permits a rollback to this specific
older deployment. A frontend rollback changes routing only; it does not
restore application data, backend code, APIs, environment variables, or
database state.

### Before an incident action

1. Confirm this is a frontend release regression and record the incident,
   affected routes, current production deployment and time. Check production
   logs and determine whether Vercel or a dependent backend is unavailable.
2. Obtain explicit owner authorization for this incident and this exact
   deployment. Confirm the Vercel CLI is already authenticated to the intended
   account using the existing secure local session; never print, copy, request,
   or place tokens in commands or logs.
3. In the Vercel dashboard, verify the project name and team scope above, the
   pinned ID and full source commit, `READY` state, production environment,
   and that the deployment still exists and is selectable. Verify the apex and
   `www` domains still belong to this project.
4. Check for an active/pending rollback and any `QUEUED`, `INITIALIZING`,
   `BUILDING`, or `BLOCKED` production deployment. Stop if anything is pending,
   unknown, or changes during the procedure. Do not cancel or promote anything
   to clear the way. Review Vercel's deployment activity and coordinate a
   brief freeze with the release owner; repeat the checks immediately before
   action. The checks reduce but cannot eliminate a race with automatic
   deployment or a concurrent operator.
5. From `frontend/`, run the helper without switches first:

   ```powershell
   .\ops\rollback-production.ps1
   ```

   This is a read-only preflight/plan; it makes scoped Vercel API GET requests
   and checks `vercel rollback status`. It exhaustively follows the
   production deployment-list pagination; it fails closed on active/unknown
   rollback state, missing or malformed pages, invalid cursors, or an
   incomplete list. It is not a live health check. Stop if CLI authentication,
   scope, project, source SHA, target readiness, response shape,
   rollback-status, or pending-deployment checks fail. Do not work around a
   failed guard or change its pinned constants.

### Explicitly approved rollback

Only after the owner approves the exact action and the incident operator has
repeated all checks above, request the explicit guarded action:

```powershell
.\ops\rollback-production.ps1 -ExecuteRollback -Confirm
```

PowerShell confirmation and an exact typed deployment ID are required. The
Vercel CLI may request an additional confirmation. Do not use `-Force`,
`-WhatIf` as evidence of completion, or an alternate target. This helper
invokes `vercel rollback` only for the pinned deployment and explicit scope;
its checks cannot make a production action race-free. If the command errors,
times out, or its result is ambiguous, do not repeat it blindly. Check
`vercel rollback status allied-autotech --scope michael-enochs-projects-3da06943`
and the Vercel dashboard first.

### Verify alias identity and service health separately

An accepted rollback command or a `READY` deployment alone does not establish
recovery. Verify these separately and capture timestamps/results in the
incident record:

1. Wait for `vercel rollback status allied-autotech --scope
michael-enochs-projects-3da06943` to show completion with no pending rollback.
2. Inspect the pinned deployment using the Vercel CLI/dashboard. Confirm its
   exact ID, project, source SHA and `READY` state. Confirm the deployment API
   reports `aliasAssigned` true and lists both `alliedautotech.com` and
   `www.alliedautotech.com` on this deployment. If alias state is absent,
   contradictory, or still points elsewhere, stop and escalate.
3. From an external browser/network, request `https://alliedautotech.com/`
   and `https://www.alliedautotech.com/`. Confirm redirects terminate on the
   approved canonical host, HTTPS is valid, and the response is served by the
   deployment just inspected (correlate with Vercel's request/deployment
   information; a healthy status code alone does not identify a deployment).
4. Check the agreed public application routes `/`, `/shop`, `/help`, and
   `/login` on the canonical production host. Verify expected page content,
   assets, redirects and absence of unexpected 5xx/errors; check the same
   behavior for any additional incident-affected public routes. Do not submit
   forms, authenticate as a customer, or trigger writes as part of this health
   check. Correlate requests with Vercel logs after the alias change.
5. Check recent production 5xx/runtime errors and the dependent backend's
   readiness independently. Record outcomes by route and domain. If alias
   assignment succeeded but route, asset, backend, or request-identity checks
   fail, report **routing rollback complete; service recovery unverified** and
   escalate. Do not describe a rollback as healthy until both identity and
   route checks pass.

### Pending `master` automatic-deployment control - approval required

No automatic-deployment or Vercel setting is changed by this runbook or helper.
The proposed control is to add `"master": false` under
`git.deploymentEnabled` in `frontend/vercel.json` (alongside the existing
release-branch entry), preventing Vercel's automatic Git deployment for
`master`. **This is pending explicit owner approval only**: it has not been
applied, and may affect expected release workflows. Until approval and a
separately reviewed change, leave the current Git deployment setting unchanged.
Do not merge branches, change GitHub/master, or use this proposal as a substitute
for the incident-time pending-deployment checks.

### Saved Preview settings

All seven values are saved only for Preview and Git branch
`deploy/private-testing-20261017`. Both build and runtime variable-name lists
were checked on the final deployment. The password is a sensitive server-only
Vercel variable, matching the existing backend gate.

| Variable                   | Value / handling                                               |
| -------------------------- | -------------------------------------------------------------- |
| `BACKEND_ORIGIN`           | `https://allied-autotech-staging-825no.ondigitalocean.app`     |
| `PRIVATE_TESTING_ENABLED`  | `true`                                                         |
| `PRIVATE_TESTING_PASSWORD` | Existing secret; never expose through `NEXT_PUBLIC_*`          |
| `SITE_INDEXING`            | `disabled`                                                     |
| `SITE_ORIGIN`              | `https://allied-autotech-staging-5ae8fa4d.vercel.app`          |
| `ASSET_STORAGE_HOSTS`      | `allied-autotech-staging-5ae8fa4d.lon1.digitaloceanspaces.com` |
| `NEXT_PUBLIC_MEDIA_HOSTS`  | Empty; managed image reads use the same-origin API proxy       |

API/worker frontend links, WebAuthn RP hostname/origins and configured callback
URLs now use this stable frontend origin. Payments, email and SMS remain disabled.
Spaces CORS permits this exact origin and the planned
`https://staging.alliedautotech.com`; it does not use wildcard origins. A temporary
administrative Spaces key was revoked after the CORS update and read-back check.
Runtime bucket permissions were not broadened.

### Repeat a deployment safely

`frontend/vercel.json` disables automatic Git deployments for this release branch.
The branch is now published. Use an explicit Preview deployment sourced from the
GitHub branch so Vercel resolves its branch-scoped environment variables. The
successful management API request was `POST /v13/deployments` for the existing
team, with this non-secret body and authenticated CLI/API access:

```json
{
  "name": "allied-autotech",
  "project": "prj_LbuHFZ0EY8fBQL2pcOP1L3YHK2cb",
  "gitSource": {
    "type": "github",
    "repoId": "1361226429",
    "ref": "deploy/private-testing-20261017",
    "sha": "8ace6e62d647d7f6253b335b1c47205cadf0147e"
  }
}
```

For a future release, use its reviewed commit SHA. Do not set `target` to
`production`. Wait for `READY`, verify all seven required names in both `env` and
`build.env`, then confirm the stable alias points to that deployment. A local CLI
upload produced a build without the branch-specific variables in this session;
it was superseded, and must not be used as the connected testing preview.
Root `.vercelignore` excludes backend/private files and bulky design evidence
from any future frontend CLI upload.

### Verification and remaining work

A real Chrome browser verified the final stable alias:

- Private-gate access: `/login` and `/api/v1/public/services` returned 401 for both
  missing and incorrect credentials, with the private-testing Basic challenge.
- With correct private access: catalogue API 200, services page 200 and login 200.
- `/api/v1/auth/session` returned 401 without an application session, confirming
  private access does not grant a customer/staff login.
- Checked responses retained `noindex, nofollow` and private/no-store caching.
- Services rendered the real empty staging catalogue and checked-in images;
  the page CSP included the exact Spaces upload hostname.
- The temporary Vercel automation bypass used for these checks was revoked.
  Browser sessions were closed. No application records were created or changed.

The browser's origin allowlist intentionally blocked the optional Vercel feedback
script. Expected unauthenticated session requests returned 401. These checks do
not establish successful authenticated saves, MFA, image uploads or checkout.
Those workflows need designated verified staging accounts and approved test data.

### Remembered private access verification - 19 October

The private-access fix is live in commit `8ace6e62d647d7f6253b335b1c47205cadf0147e`
and deployment `dpl_A9v1J2s4pN2USSHUxZHhGgBjGbxE`. The cookie contains a random,
HMAC-signed, host-bound proof with an eight-hour expiry, not the shared password.
The backend keeps its existing Basic gate; the frontend supplies that credential
only as an internal request override for its fixed `/api/v1` rewrite after
validating the private cookie. Account cookies, origin and CSRF headers remain
intact. No database or backend change was required.

Validation completed:

- 20 targeted unit tests passed, including expiry, tampering, host binding,
  password rotation, cookie attributes and application-header preservation.
- Targeted ESLint, formatting, full production build and TypeScript passed.
- The built Next server passed the existing synthetic-API probe extended for
  cookie-only page/API access and response-secret checks. Docker was unavailable,
  so this probe ran against a temporary local production server and fake API on
  loopback, with generated test credentials and no database connection. Both
  processes were stopped afterwards; this was not a Docker-image test.
- Hosted Chrome received the Secure/HttpOnly/SameSite=Lax cookie, invisible to
  page JavaScript. A separate context using only the stored cookie, with no Basic
  credentials configured, passed reload, new tab, tab switching, catalogue API
  and a page reload after the expected unauthenticated application-session 401.
- Every checked browser request lacked an Authorization header; returned headers
  contained no shared testing password or upstream Basic credential. API session
  still required application authentication. Missing and altered private cookies
  returned 401 with the private gate challenge.
- All seven build/runtime environment names were verified, the stable alias was
  assigned, and production deployment/protection remained unchanged. Temporary
  automation access was revoked and both verification browsers were closed.

### Owner setup: Google Workspace, Cloudflare, Resend and staging

Updated 19 October 2026. This replaces the older pasted checklist's Hobby-plan,
unpublished-branch and Cloudflare-forwarding instructions. The owner explicitly
chose Google Workspace for branded Gmail mailboxes. The selected Allied AutoTech
application Super Admin email is `alliedautotechltd@gmail.com`; selecting it does
not create, verify or grant ownership to an account. Google Workspace's administrator
account is separate from this application's Super Admin.

| Checklist item                                    | Current status                                               | Next action                                                |
| ------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Vercel Pro and published private branch           | Complete                                                     | Preserve Preview-only configuration                        |
| Private frontend and backend connection           | Complete on the `vercel.app` hostname                        | Continue using the current private URL                     |
| DigitalOcean database, private Spaces and workers | Connected; app ACTIVE                                        | No new infrastructure purchase required                    |
| Spaces CORS                                       | Allows current and planned staging origins                   | No CORS change needed for the custom-domain switch         |
| Vercel custom staging domain                      | Attached to the release branch                               | Cloudflare CNAME and TLS still pending                     |
| Google Workspace mailbox                          | Subscription/setup not confirmed; no published root MX found | Owner completes Google setup below                         |
| Google verification, SPF, DKIM and DMARC          | No root SPF/DMARC found at this audit                        | Add account-specific records during setup                  |
| Resend sending domain                             | Required DNS records not found                               | Verify `mail.alliedautotech.com`                           |
| Resend credentials                                | Last local key check rejected it as invalid                  | Save a new sending-only key locally                        |
| Reply-To support                                  | Implemented and tested in source                             | Build/release the updated backend before email activation  |
| Initial application owner                         | Email selected; provisioning not performed                   | Normal registration/verification, then guarded bootstrap   |
| Messaging/payments                                | Disabled                                                     | Keep disabled until the relevant setup/testing is complete |

DNS is a point-in-time observation, not proof of the contents of a provider's
private dashboard. No Cloudflare/Google/Resend account settings were changed.
Vercel and DigitalOcean configuration were inspected read-only in this audit.

#### 1. Create the branded Gmail mailbox

1. Open [Google Workspace](https://workspace.google.com/). If you already have a
   Workspace subscription, use [Google Admin](https://admin.google.com/) instead
   of creating another subscription.
2. For one owner initially handling mail, review Business Starter with one user.
   Google shows the final local price, tax, billing interval, trial and renewal
   terms at checkout. Any new subscription is the owner's purchase decision;
   the deployment agent has not purchased or started a paid plan.
3. Choose **use an existing domain** and enter `alliedautotech.com`.
4. Use `alliedautotechltd@gmail.com` as an external contact/recovery address where
   Google requests one. Create a separate Workspace login such as
   `owner@alliedautotech.com`. This does not convert or replace the existing Gmail
   account. Keep the owner login private and enable Google two-step verification.
5. Google will provide a domain-verification TXT record. Copy its exact value.

Starter supports custom business email; see [Google's plan comparison](https://workspace.google.com/pricing.html).
Do not share one user's password with staff; separate staff access can be planned
when needed, with any additional cost approved first.

#### 2. Verify ownership and route incoming mail to Google

1. Open Cloudflare, select `alliedautotech.com`, then **DNS > Records**.
2. Add Google's verification TXT at the name Google specifies (usually `@`),
   with its complete `google-site-verification=...` value and TTL Auto.
3. Return to Google Admin and complete verification.
4. Follow **Activate Gmail** in Google's setup flow. For a new setup, Google's
   published MX configuration is:

| Type | Name | Value             | Priority | TTL  |
| ---- | ---- | ----------------- | -------- | ---- |
| MX   | `@`  | `smtp.google.com` | `1`      | Auto |

Use the exact instructions shown for your Google account. Existing working
legacy Google `aspmx` records are supported and need not be changed merely to
match this new-account example.

The earlier `route1`, `route2`, `route3.mx.cloudflare.net` records are for
Cloudflare forwarding. Do not add them for this Workspace plan. If forwarding
has since been activated, disable that routing configuration during the planned
Google cutover, then replace its root MX records with Google's. Preserve any
unrecognized working mail provider until its use is checked. Root mailbox MX
changes must not remove Resend's later `send.mail` bounce MX record.

5. Return to Google Admin and finish **Activate Gmail**. DNS may take time to
   propagate; wait for Google's verification before treating the mailbox as ready.
6. Sign in to Gmail as the new Workspace user and test receiving and replying
   using a separate external inbox.

Source: [Google MX setup](https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace).

#### 3. Authenticate Google mail and create business addresses

In Cloudflare add one root SPF TXT for the planned Google-only root-domain sender:

```text
Type: TXT
Name: @
Content: v=spf1 include:_spf.google.com ~all
TTL: Auto
```

Do not add a second SPF record at the same name. If a root SPF already exists,
review and edit it to include the actual active senders. Resend will use its own
sending subdomain and dashboard-supplied SPF; do not copy its subdomain record to
`@`. The previously proposed Cloudflare-only SPF is not the Workspace setting.
See [Google SPF setup](https://knowledge.workspace.google.com/admin/security/set-up-spf).

In Google Admin go to **Apps > Google Workspace > Gmail > Authenticate email**,
select the domain, and generate a 2048-bit DKIM record when available. Add the exact
TXT name/value Google displays in Cloudflare (usually `google._domainkey`), then
return and select **Start authentication**. Google may require a waiting period
after Gmail activation before a key can be generated. Follow its displayed state.
See [Google DKIM setup](https://knowledge.workspace.google.com/admin/security/set-up-dkim).

If `_dmarc` has no existing TXT policy, add this non-enforcing starter policy:

```text
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none;
TTL: Auto
```

This does not request aggregate reports and does not enforce quarantine/rejection.
After Google and Resend authentication are tested, review reporting and a stronger
policy. Do not overwrite a pre-existing stronger policy or add duplicate policies.
See [DMARC guidance](https://resend.com/docs/dashboard/domains/dmarc).

In Google Admin go to **Directory > Users > your Workspace user > Alternate emails**
and create addresses that the owner will monitor:

| Address                       | Purpose                                             | Initial destination            |
| ----------------------------- | --------------------------------------------------- | ------------------------------ |
| `support@alliedautotech.com`  | Customer care, complaints and replies to app emails | Owner's Workspace inbox        |
| `hello@alliedautotech.com`    | General enquiries                                   | Same inbox                     |
| `billing@alliedautotech.com`  | Invoices and payment/refund correspondence          | Owner-only inbox initially     |
| `bookings@alliedautotech.com` | Service scheduling                                  | Optional alias                 |
| `sales@alliedautotech.com`    | Products and vehicles                               | Optional alias                 |
| `privacy@alliedautotech.com`  | Privacy requests                                    | Optional monitored alias       |
| `security@alliedautotech.com` | Security reports                                    | Optional owner-monitored alias |

These are aliases, not separate user logins. Google supports up to 30 aliases per
user without an additional alias charge. If billing needs a different audience
from support later, do not place both in a shared inbox. See [Google aliases](https://knowledge.workspace.google.com/admin/users/add-or-delete-an-alternate-email-address-email-alias).

In the Workspace Gmail settings, configure the aliases under **Accounts > Send
mail as** as prompted, then test that a reply from `support@` actually displays
that address. Do not assume an alias's receiving setup alone selects the reply
From address. See [Gmail send-as guidance](https://support.google.com/mail/answer/22370).

#### 4. Configure Resend for automated sending

1. In [Resend Domains](https://resend.com/domains), add `mail.alliedautotech.com`.
   Keep Receiving disabled. Google handles staff mail on the root domain.
2. Choose manual DNS setup and copy the exact records into Cloudflare's
   `alliedautotech.com` zone. The usual names are below; the actual types, values,
   region and priority must come from your Resend dashboard.

| Purpose     | Typical Cloudflare name  | Value                               |
| ----------- | ------------------------ | ----------------------------------- |
| DKIM        | `resend._domainkey.mail` | Complete Resend-supplied key/target |
| Sending SPF | `send.mail`              | Resend-supplied SPF TXT             |
| Bounce MX   | `send.mail`              | Resend-supplied MX and priority     |

These do not replace Google's root MX. Use DNS-only for any CNAME Resend supplies.
The `mail` subdomain is a sending identity; no website A record or mailbox purchase
is required for it. Return to Resend and wait for Verified. See
[Resend's Cloudflare instructions](https://resend.com/docs/guides/dns/cloudflare). 3. Create a key named `allied-autotech-staging`, with Sending access restricted
to the verified domain. Do not purchase a Resend upgrade without approving it. 4. Save the key locally in `backend/.env` as `RESEND_API_KEY`. Never paste it into
chat, frontend variables, Git or screenshots. The old saved key was rejected. 5. Prepare these non-secret settings, retaining disabled delivery:

```dotenv
RESEND_FROM_EMAIL=noreply@mail.alliedautotech.com
RESEND_REPLY_TO_EMAIL=support@alliedautotech.com
STAGING_EMAIL_ALLOWLIST=alliedautotechltd@gmail.com
EMAIL_DELIVERY_ENABLED=false
SMS_DELIVERY_ENABLED=false
```

`noreply@mail.alliedautotech.com` is a Resend sender, not another paid Workspace
user. The application validates plain email addresses in these settings; do not
include a display name. The new `RESEND_REPLY_TO_EMAIL` setting is supported by
the prepared source change but is not in the currently hosted backend image yet.
Setting it on that old image will not activate Reply-To. The updated worker images
must be released before email is enabled. Sources: [Resend API keys](https://resend.com/changelog/new-api-key-permissions)
and [Reply-To API field](https://resend.com/docs/api-reference/emails/send-email).

#### 5. Add the private website CNAME in Cloudflare

The Vercel domain and branch assignment are already prepared. Add:

| Type  | Name      | Target                                | Proxy    | TTL  |
| ----- | --------- | ------------------------------------- | -------- | ---- |
| CNAME | `staging` | `e59765530a95057a.vercel-dns-017.com` | DNS only | Auto |

This exact preferred target was rechecked through Vercel's API on 19 October.
In Vercel open **allied-autotech > Settings > Domains** and wait for a valid
configuration and HTTPS certificate. Do not change root or `www` website records.
No nameserver transfer or additional domain purchase is needed.

Keep using the current `vercel.app` preview until the coordinated configuration
switch below is complete; DNS alone does not change login links or passkey scope.

#### 6. Vercel and DigitalOcean: coordinate the hostname switch

These are the operator steps I can complete after DNS/TLS is ready. The owner
need not manually re-enter existing secrets or recreate infrastructure.

In Vercel **Settings > Environment Variables**, retain Preview-only scope for
branch `deploy/private-testing-20261017`. Change only `SITE_ORIGIN` to
`https://staging.alliedautotech.com`. Preserve the other six settings in the table
above. Rebuild/redeploy from the reviewed Git branch and verify the environment
names at build and runtime. Do not promote to Production.

In DigitalOcean **Apps > allied-autotech-staging > Settings**, the API will need:

```dotenv
FRONTEND_URL=https://staging.alliedautotech.com
WEBAUTHN_RP_ID=staging.alliedautotech.com
WEBAUTHN_ORIGINS=https://staging.alliedautotech.com
FRONTEND_VERIFY_EMAIL_URL=https://staging.alliedautotech.com/verify-email
FRONTEND_RESET_PASSWORD_URL=https://staging.alliedautotech.com/reset-password
FRONTEND_PRIVILEGED_INVITATION_URL=https://staging.alliedautotech.com/staff/accept-invitation
PAYSTACK_CALLBACK_URL=https://staging.alliedautotech.com/payments/complete
```

Match the general worker's `FRONTEND_URL` and configured callback. A callback URL
change does not enable payments. Preserve existing encrypted secrets, database
permissions, image/runtime safeguards, component sizes, private gate and disabled
live payment/SMS flags. Spaces CORS already permits this exact custom origin.
Use the final hostname before enrolling passkeys, because passkeys are RP-bound.

Once the updated backend release is available, Resend is verified and the owner
mailbox test succeeds, set the API and both workers' `STAGING_EMAIL_ALLOWLIST` to
`alliedautotechltd@gmail.com`. Provider key/from/reply settings belong on the
identity and general workers, not Vercel or the migrator. Enable email consistently
on API/identity/general only for the reviewed recipient test. Review pending
outbox work before enabling workers. Do not mark disabled jobs delivered or turn
on SMS or payments as part of this step.

The preparation file is locally available at
`backend/ops/digitalocean/.private/staging-email-preparation.env`; it contains a
blank key placeholder and disabled flags, and is not a live deployment.

#### 7. Create and verify the application owner

After private-domain and email checks pass:

1. Open the private site and enter the private testing credentials if prompted.
2. Register using `alliedautotechltd@gmail.com` and a password you choose privately.
   If this account already exists, use the normal sign-in/verification flow.
3. Open the verification message in that Gmail inbox and verify the address.
4. Tell me verification succeeded. I will inspect this exact selected account,
   confirm the staging host/port/database, then run the guarded initial-owner
   bootstrap using its verified UUID. Existing ownership cannot be overwritten.
5. Sign in again and complete the application's MFA setup. The private testing
   cookie and Google two-step verification do not replace application MFA.
6. Then test dashboard access, service/vehicle uploads and approved test catalogue
   data. No local customer or admin data will be copied implicitly.

No ownership or verification bypass has been performed. The selected email is
recorded in the private deployment preparation, not hardcoded as an application
privilege rule.

Tell me which steps are complete using non-secret information: Workspace domain
verified/Gmail active, support alias tested, Resend domain verified, key saved
locally, and staging CNAME added. Do not send passwords, verification links,
recovery codes or API keys. Purchases remain subject to the owner's approval.

Private evidence is under `backend/ops/digitalocean/.private/*20261019*`.
Earlier local Docker connection/secret-exposure checks remain documented in the
[backend deployment record](../../backend/docs/staging-deployment-20261017.md).
References: [branch-specific environment variables](https://vercel.com/docs/environment-variables),
[sensitive variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables),
[Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration),
and [temporary automation bypass management](https://vercel.com/docs/rest-api/projects/update-protection-bypass-for-automation).

## Production deployment

Vercel hosts the Next.js frontend. The Express API, PostgreSQL database, identity
outbox worker and general worker need their own durable hosting. A local PC or
temporary development tunnel is not a production backend.

1. Import this repository with **Root Directory `frontend`**, **Next.js** and
   **Node.js 24.x**. Keep `npm ci`, `npm run build` and the default output directory.
2. In Vercel's **Production** environment, set
   `SITE_ORIGIN=https://alliedautotech.com` for canonical URLs. It is optional;
   leaving it unset keeps search indexing disabled and omits canonical URLs.
   Leave `BACKEND_ORIGIN` unset until
   your API is hosted. This permits a frontend-only production deployment;
   login, live data, bookings, payments and saves remain unavailable. Once hosted,
   set `BACKEND_ORIGIN` to the API's distinct HTTPS origin without `/api/v1`.
   Neither origin accepts credentials, query strings or fragments.
3. Set `SITE_INDEXING=disabled` while verifying the release. Change it to `enabled`
   and redeploy when the approved public domain is ready. Preview deployments
   disable indexing even if production values are accidentally copied.
4. If needed, configure `NEXT_PUBLIC_MEDIA_HOSTS`, `ASSET_STORAGE_HOSTS` and the
   restricted `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` using
   [`.env.production.example`](../.env.production.example). Allowlists contain
   bare hostnames; backend storage CORS must allow the actual frontend origin.
5. Prepare the backend using its [runtime/deployment runbook](../../backend/docs/owner-staging-runbook.md):
   production runtime settings, TLS database access, durable object storage,
   process-specific secrets, controlled migrations, API health checks and both
   background workers. Set its authentication/email/payment frontend origins as
   described below. Confirm allowed ingress/proxy settings on the selected host.
6. Run the local release checks below, deploy from Vercel, and complete the
   post-deployment checks against the matching hosted backend. Use isolated test
   accounts and provider test mode before enabling live payment processing.

Production builds stop early if a supplied frontend or backend origin is invalid.
An omitted frontend origin disables indexing; an omitted backend enables frontend-only mode.
Configuration checks do not establish that the remote API is online. GitHub
Actions runs the frontend release checks on Linux with example origins; it does
not publish a deployment or validate the database, workers or payment providers.
For a public launch, also review the remaining integration work in the
[completion audit](completion-audit.md); a passing frontend build is not full
platform sign-off.

Local production verification from the repository root:

```powershell
npm --prefix frontend ci
$env:BACKEND_ORIGIN = "https://your-api-host.example"
$env:SITE_ORIGIN = "https://your-frontend-host.example"
$env:SITE_INDEXING = "disabled"
npm run check:production
```

Replace both origins with your actual hosted addresses. `check:production` runs
lint, type checking, unit tests, a native Vercel production build and formatting
checks. It sets `VERCEL`/`VERCEL_ENV` only in the child process and does not deploy.
Type checking generates Next.js route/layout types first, so a clean checkout
does not depend on files left by a previous development server or build.
Normal local builds still prepare the standalone server used by `npm start`.

## Preview just the frontend — no backend required

1. Push the frontend changes to your Git repository and import it into Vercel.
2. Set **Root Directory** to `frontend` and **Framework Preset** to **Next.js**.
3. Keep **Install Command** as `npm ci`, **Build Command** as `npm run build`,
   and **Output Directory** at the framework default.
4. Leave `BACKEND_ORIGIN` unset (remove it if you already added a localhost or
   tunnel URL). Set `SITE_INDEXING=disabled` and leave `SITE_ORIGIN` unset.
5. Use a **Preview** deployment (a branch outside Vercel's configured production
   branch, or `vercel deploy` from `frontend`). Frontend-only Production is also
   supported without either origin. Set `SITE_ORIGIN=https://alliedautotech.com`
   when configuring your public domain.
   Redeploy after changing environment variables.

No database, API host or tunnel is needed. The landing page, public layouts,
navigation and forms can render. Live lists show unavailable states; login,
protected dashboards and saves will work after an API is connected. This mode
does not simulate accounts, data or successful submissions.

The sections below are optional guidance for connecting a backend later.

The Next.js frontend is a separate Vercel project. The Express API, PostgreSQL
database and background workers can continue running on your PC. A hosted frontend
does not require changing the backend to staging or production.

## Use the backend on your PC

For development, connect Vercel to your local API through an HTTPS tunnel:

```text
Vercel frontend /api/v1 → HTTPS tunnel → your PC:5000 → your local database
```

Requests from the deployed frontend read and write the same database as your local
backend. Backend code changes take effect after its development server reloads;
frontend code changes still require a Vercel redeploy. Setting `localhost` in
Vercel points at a Vercel machine, not your PC.

1. Keep your existing local backend settings and database credentials. Use
   `NODE_ENV=development` and `DEPLOYMENT_ENV=local`; do not copy production env
   templates. Run `npm run dev` from `backend` if the API is not already running.
2. Install Cloudflare's tunnel client on Windows:

   ```powershell
   winget install --id Cloudflare.cloudflared --exact
   ```

   Open a new PowerShell window after installation, then run:

   ```powershell
   cloudflared tunnel --url http://127.0.0.1:5000
   ```

   Keep this window open. It prints an HTTPS address such as
   `https://random-words.trycloudflare.com`. Cloudflare Quick Tunnels do not require
   an account or a domain. This address makes your API reachable over the Internet;
   the application's authentication and permissions still apply.

3. Import the frontend using the settings below. In Vercel, set `BACKEND_ORIGIN`
   to the actual tunnel address, with no `/api/v1` suffix. Set
   `SITE_INDEXING=disabled` and leave `SITE_ORIGIN` empty. Apply the variables to
   the Vercel Preview environment used by this deployment, then deploy/redeploy.
   A Preview deployment does not change your local backend's `NODE_ENV` or
   `DEPLOYMENT_ENV`.
4. Add your actual Vercel frontend origin to the local backend's existing
   `FRONTEND_URL` list. Preserve any origins already needed locally. For example:

   ```dotenv
   FRONTEND_URL=http://localhost:3000,https://your-app.vercel.app
   ```

   Restart the backend after editing its env file. Use the frontend address here,
   not the tunnel address. This allows login and form saves through the existing
   CORS/CSRF checks.

5. Open the Vercel frontend and log in using your existing local account. Keep your
   PC, database, backend and tunnel running while using it. If the backend is
   stopped, its data-dependent pages and saves will stop working.

A new Quick Tunnel normally gets a new URL. When that happens, update
`BACKEND_ORIGIN` in Vercel and redeploy. Backend code or database changes do not
require this while the tunnel URL stays the same.

If you use **passkeys**, their relying-party hostname and allowed origins must
match the Vercel frontend hostname. A passkey registered for `localhost` cannot
authenticate a different domain; TOTP uses the existing account enrollment.
For email links opened on the deployed frontend, set the local backend's frontend
verification/reset/invitation URLs to that frontend as described below.

This workflow keeps the database on your PC. The database port is not tunneled.
The tunnel connects only to the API on port 5000.

## Import settings

Import this Git repository into Vercel with these settings:

| Setting          | Value                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Root Directory   | `frontend`                                                                     |
| Framework Preset | Next.js                                                                        |
| Node.js Version  | 24.x (also set in `package.json`)                                              |
| Install Command  | `npm ci`                                                                       |
| Build Command    | `npm run build`                                                                |
| Output Directory | Turn Override off; do not enter `Next.js default`, `out` or `.next/standalone` |

`frontend/vercel.json` supplies the framework and commands.

If the build reports a missing directory named `Next.js default`, open the
project's Settings, then Build and Deployment, remove that Output Directory
override and save. Redeploy after saving. That text is a UI description, not a
folder name; the Next.js preset determines the output directory automatically.

Keep Vercel's automatic
system environment variables enabled. `VERCEL=1` selects native Next.js output and
skips standalone asset copying. Local builds and other Node hosts still produce
the standalone server used by `npm start`. Vercel does not run `npm start`.

## Frontend environment variables

The backend and storage settings are optional for a frontend-only deployment.
`SITE_ORIGIN` is optional; leaving it unset keeps indexing disabled. For the local-backend workflow,
use the tunnel URL and keep indexing disabled. A separately hosted backend can
also be used later.

| Variable                  | Value                                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_ORIGIN`          | Leave unset for frontend-only Preview or Production. To connect an API later, use its reachable HTTPS origin, for example `https://api.example.com`. No `/api/v1`, credentials, query or fragment. |
| `SITE_INDEXING`           | `disabled` for previews/staging. Enable only for the intended public production site.                                                                                                              |
| `SITE_ORIGIN`             | Approved production HTTPS frontend origin for canonical URLs. Leave empty on previews.                                                                                                             |
| `NEXT_PUBLIC_MEDIA_HOSTS` | Optional comma-separated image-storage hostnames; no scheme or path. Needed for externally hosted product/vehicle images.                                                                          |
| `ASSET_STORAGE_HOSTS`     | Optional comma-separated private-upload/download storage hostnames. Must match backend storage and its browser CORS configuration.                                                                 |

An omitted backend origin enables a frontend-only Preview or Production deployment.
Both origins are optional. If supplied, the frontend origin must be a valid HTTPS
origin and the backend origin must be a reachable HTTPS origin; local or non-HTTPS origins are rejected. A build
does not prove that the remote API is online or correctly configured. Redeploy
after environment changes: API rewrites and public media settings are compiled
at build time. Keep database credentials, signing keys and provider secrets on
the backend. Local `.env` files are excluded from CLI uploads.

## Connect authentication and payments

Browser requests keep using `/api/v1` on the frontend origin. The existing Next.js
rewrite forwards requests to the API. Server-rendered public pages call that same
configured backend directly. No public API base URL is needed.

On the **backend**, configure the actual frontend address:

- `FRONTEND_URL`: comma-separated exact allowed frontend HTTPS origins. Used by
  CORS and CSRF checks; adding a Vercel deployment alone does not update this list.
- `WEBAUTHN_RP_ID`: the stable frontend hostname, without `https://` or a path.
  `WEBAUTHN_ORIGINS`: exact corresponding HTTPS origins. Passkeys are domain-bound;
  use a stable staging hostname for preview authentication testing.
- `FRONTEND_VERIFY_EMAIL_URL`: `<frontend-origin>/verify-email`.
- `FRONTEND_RESET_PASSWORD_URL`: `<frontend-origin>/reset-password`.
- `FRONTEND_PRIVILEGED_INVITATION_URL`: `<frontend-origin>/staff/accept-invitation`.
- If payment providers are enabled, set their configured callback URLs to
  `<frontend-origin>/payments/complete`. Provider webhooks remain backend endpoints.

For a separately hosted production backend, use its production runtime settings, including secure
host-only session cookies. Existing cookies and CSRF protections remain in place;
do not add a cookie domain or bypass origin validation. Configure trusted proxy
settings for the actual backend ingress topology using the backend runbook.

For authenticated previews, explicitly allow the chosen preview/staging origin on
the selected backend (including your local backend). A changing preview URL does
not automatically become trusted.

## Verification after deployment

Dependency checks on 11 October 2026: `npm audit --omit=dev` reported zero frontend
runtime vulnerabilities. The full audit reported five high-severity entries in
the ESLint dependency chain, all stemming from
[the unpatched braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The affected tool processes repository glob patterns during development/linting.
No framework downgrade, forced audit fix or advisory suppression was applied.
Track an upstream fix and rerun the full audit when updating the tooling. CI gates
high/critical runtime advisories with `npm audit --omit=dev --audit-level=high`.

1. Open public services/products and verify data loads through the deployed API.
2. Log in with a test account, refresh the dashboard, and verify the session remains.
3. Check a permitted form save and logout; confirm there are no CSRF/origin errors.
4. Check staff MFA on its configured stable hostname.
5. If configured, verify images and a test private upload against storage CORS.
6. Keep preview robots disabled. Check canonical links only on the approved domain.

Typical configuration failures:

- A supplied `BACKEND_ORIGIN` is rejected: remove it for a frontend-only preview, or use a valid HTTPS API origin, then redeploy.
- `/api/v1` returns 502/504: check the backend origin, HTTPS certificate and reachability.
- Mutations return 403: check exact backend origin allowlists and the account's permissions.
- Passkeys fail: check the RP hostname and WebAuthn origin configuration.

Local verification can simulate Vercel build mode in PowerShell (example origin
only; this does not deploy or prove API connectivity):

```powershell
$env:VERCEL = "1"
$env:VERCEL_ENV = "preview"
$env:BACKEND_ORIGIN = "https://api.example.com"
npm run build
```

Run this in a dedicated terminal so these settings do not replace your normal local
development environment. Build from `frontend`, not the repository root.

References: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/),
[Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs),
[monorepo root directories](https://vercel.com/docs/monorepos),
[Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
[system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables),
and [external rewrites](https://vercel.com/docs/rewrites).
