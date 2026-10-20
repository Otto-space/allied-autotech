# Owner staging setup and email handoff ? 20 October 2026

This is the current operational handoff. It supersedes the September planning text. Preserve the existing database, hosting resources, Google Workspace mail records and production Vercel settings. No additional subscription/resource purchase or shared Git history rewrite is authorised by this handoff.

## Current state

| Area | Status | Evidence / next action |
|---|---|---|
| Staff mail | User-verified | Google Workspace with info, sales, support and accounts Groups. User reports external SPF/DKIM pass. Public Google MX/SPF and google._domainkey records present. |
| Resend sender | Provider accepted test; receiving unverified | Current restricted sending key is recognised; DNS for notify sender exists. A single authorised test to alliedautotechltd@gmail.com returned HTTP 200 on 20 October. Inbox/header confirmation pending. |
| DMARC | Pending external action | No _dmarc.alliedautotech.com TXT returned. Must verify DNS AND fresh external message before calling complete. |
| Private backend | Verified existing deployment | App e06d8cea-250f-4f26-ac09-78d02c3d5b57, active deployment 4bd5e10f-a02d-4cab-ab43-8608dc2e34ed at audit. No duplicate resources created. |
| Frontend | Existing private Preview | allied-autotech-staging-5ae8fa4d.vercel.app; production untouched. Vercel Pro already purchased by user. |
| Custom staging domain | Registered; DNS pending verification | staging.alliedautotech.com belongs to the Preview branch. User reports CNAME saved; resolvers still NXDOMAIN at initial recheck. Do not switch canonical links until HTTPS succeeds. |
| Email source | Tests passed; deployment pending | Branded sender parsing, global/per-message Reply-To, encrypted department outbox routing and general-worker delivery. |
| Super Admin | Pending verified account/bootstrap | Selected address alliedautotechltd@gmail.com. Normal account verification, guarded role bootstrap and MFA still required; no password invented and no verification bypass. |
| Live payments/SMS/public launch | Disabled | Preserve private gate, indexing disabled, Paystack/Monnify disabled and SMS false. |

## Do these now

1. Verify the Cloudflare staging CNAME below and wait for Vercel domain configuration and HTTPS to pass. Tell Codex if the record name/target differs.
2. Check the test email in alliedautotechltd@gmail.com, including spam. Gmail ? More ? Show original: report delivery and SPF, DKIM, DMARC results, not raw headers/tokens.
3. Resend ? API Keys: revoke the historically exposed key. The current local key is different. Do not revoke the new sending key accidentally. Confirm revocation; Codex cannot manage keys using a sending-only key.
4. Add/review DMARC using the steps below; verify with a new external message from Workspace and a fresh Resend message when authorised. Keep this item pending until both checks are documented.
5. Codex: build/push reviewed images, preserve immutable provenance and database safety checks, configure email on both workers with only the designated tester allowlisted, deploy and check health/worker processing.
6. Register/verify the selected Super Admin email on private staging. Then use the existing dry-run bootstrap, confirm its actual UUID and apply the narrow role change. Complete MFA. This database write requires target/backup safeguards; it has not been performed by this email audit.
7. Test the four Workspace Groups from a designated external mailbox and staff replies as the Group. This is a user-account step; no department broadcast was sent by Codex.

## Cloudflare and domain cutover

Select **alliedautotech.com ? DNS ? Records**. Preserve Google MX/SPF/DKIM and google-site-verification records. Google Workspace owns root mail; do not enable Cloudflare Email Routing on the root or restore its route*.mx.cloudflare.net records.

| Type | Name | Target/content | Setting |
|---|---|---|---|
| CNAME | staging | e59765530a95057a.vercel-dns-017.com | DNS only (grey cloud), TTL Auto; exact target from this Vercel project |
| TXT | _dmarc | v=DMARC1; p=none; | Initial non-enforcing policy only; inspect existing record first, never add a second DMARC record |
| Resend-assigned records | Exact names shown under notify.alliedautotech.com | Copy exact values from Resend Domains; DNS-only for any CNAME | Existing Resend records are present; do not replace working records with guessed Amazon/other values |

The minimal p=none record establishes a policy but does not request aggregate reports. For reports, configure Cloudflare DMARC Management and use its exact generated reporting destination, or a dedicated monitored reports mailbox after confirming it exists. Do not invent a rua mailbox. Review reports before proposing quarantine/reject; those enforcement changes require review of every legitimate sender. Root DMARC can cover the notify subdomain absent a more specific policy; actual From alignment must be checked in fresh received headers.

Vercel ? project allied-autotech ? Settings ? Domains: staging.alliedautotech.com must remain associated with **deploy/private-testing-20261017**, not master/production. Vercel provisions TLS once DNS is correct. Keep Cloudflare authoritative nameservers. DNS-only avoids another proxy/certificate layer for this staging hostname.

The backend remains **https://allied-autotech-staging-825no.ondigitalocean.app**. That is the established intentional API address, so api-staging is not needed now. Do not create a second App Platform app or point staging at the API.

After DNS and certificate pass, apply this coordinated cutover:

| Component | Setting |
|---|---|
| Vercel branch Preview | SITE_ORIGIN=https://staging.alliedautotech.com; BACKEND_ORIGIN unchanged; SITE_INDEXING=disabled; PRIVATE_TESTING_ENABLED=true; preserve existing password |
| API | FRONTEND_URL includes exactly new staging and existing private Preview during transition; FRONTEND_VERIFY_EMAIL_URL=https://staging.alliedautotech.com/verify-email; FRONTEND_RESET_PASSWORD_URL=https://staging.alliedautotech.com/reset-password; FRONTEND_PRIVILEGED_INVITATION_URL=https://staging.alliedautotech.com/staff/accept-invitation |
| API WebAuthn | WEBAUTHN_RP_ID=staging.alliedautotech.com and exact WEBAUTHN_ORIGINS; existing passkeys scoped to vercel.app cannot silently transfer, so plan re-enrolment before removing the old host |
| General worker | FRONTEND_URL first entry is new staging, so signed booking reminder URLs use it |
| Payment callbacks | PAYSTACK_CALLBACK_URL and MONNIFY_CALLBACK_URL, if configured later, use https://staging.alliedautotech.com/payments/complete; leave providers disabled now |
| Webhooks | Direct backend /api/v1/webhooks/paystack and /api/v1/webhooks/monnify; provider signatures/raw body checks remain required. No OAuth redirect or Push config exists |
| Spaces | Existing CORS already includes new custom staging plus old Preview; exact origins only, GET/HEAD/PUT and upload checksum/content headers |
| Frontend image policy | ASSET_STORAGE_HOSTS=allied-autotech-staging-5ae8fa4d.lon1.digitaloceanspaces.com; preserve any approved existing public media host list |

Browser API calls remain relative /api/v1 through Next rewrites. Do not change them to direct cross-origin calls: existing credentialed session/CSRF checks require same-origin requests. Application cookies and private-access cookies are Secure/HttpOnly, host-only; do not add a broad .alliedautotech.com cookie domain. The private-access cookie lasts eight hours in the same browser profile. A different browser/hostname legitimately requires new private access.

## Google Workspace and Resend responsibilities

Google Workspace is for staff reading/replying in Gmail. Resend sends application verification, reset, invitation and transactional messages. No Gmail password, Google admin password or Workspace SMTP credential belongs in backend/.env.

Google Admin ? Directory ? Groups: retain info, sales, support and accounts. Assign the intended staff members and subscriptions. Allow external posting where customers must contact a Group, while keeping membership/conversation visibility restricted to appropriate staff. Test receipt from outside the organisation. Configure authorised staff to send as the Group through the supported Workspace/Gmail setup and confirm the visible From address in an external test. Creating a Group does not itself prove replies use that identity.

Resend ? Domains ? notify.alliedautotech.com: preserve the verified configuration. The live DNS currently uses Resend-provided records; copy the dashboard exactly, not examples from another provider. From: **Allied AutoTech <notifications@notify.alliedautotech.com>**. Customer-notification Reply-To: **support@alliedautotech.com**.

Internal enquiry alerts use the same verified company From and the validated customer's email as Reply-To. Routing: GENERAL ? info; PRODUCT/VEHICLE/QUOTATION ? sales; SERVICE/BOOKING/COMPLAINT ? support. Accounts remains staff finance correspondence; no unused billing routing variable was invented. These emails are queued atomically with requests, encrypted at rest, processed by the general worker with claim fencing/bounded retries/provider idempotency. Disabled/unallowlisted deliveries remain visible as failures/dead letters; they are never marked delivered. Public enquiry submissions have their existing rate limiting, but repeated independent submissions are separate requests. Provider idempotency is not an indefinite exactly-once guarantee after arbitrary downtime/manual replay.

## Credential acquisition and storage

Existing working infrastructure credentials already exist. Retrieve/preserve them; do not regenerate cryptographic keys for a redeploy. The smallest missing staging set is the verified Resend sender/key plus global reply destination and the designated tester allowlist. DNS requires no additional billable resource. Workspace Groups require no application API credential.

| Variable(s) | Purpose / required for | Provider and exact steps | Minimum permission | Store | Verify |
|---|---|---|---|---|---|
| DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD | Existing staging runtime database | DO ? Databases ? allied-autotech-staging-db ? Connection Details, select allied_autotech_staging and restricted application role; preserve current role/password | Connect + schema usage and DML only; no ownership/DDL/TRUNCATE/role creation | API and both worker RUN_TIME; password encrypted SECRET; ignored private inputs for operator | Strict TLS, read-only db:check and role checks |
| MIGRATION_DB_USER, MIGRATION_DB_PASSWORD | Private release runner's distinct role; rendered to job DB_USER/DB_PASSWORD | Retrieve existing reviewed migration-role secret from protected inputs; doadmin password only for approved provisioning, never runtime | Reviewed DDL role on staging; backup account separate | Ignored private inputs / trusted migration runner; never Vercel | Confirm exact host:25060/allied_autotech_staging, guarded backup/migration and db:check |
| DB_SSL_CA_BASE64, DB_SSL_CA_FILE | Managed PostgreSQL certificate validation | DO database ? Connection Details ? Download CA certificate; existing downloaded PEM is in protected .private | Public certificate, not a private key | CA base64 SECRET RUN_TIME; fixed file /tmp/allied-autotech-secrets/database-ca.pem; shell unsets helper | Correct CA/hostname passes; wrong CA/hostname fails; no rejectUnauthorized=false |
| TOKEN_HASH_KEY, MFA_ENCRYPTION_KEY, OUTBOX_ENCRYPTION_KEY, ASSET_TICKET_KEY and *_ID | Existing token hashes, MFA, encrypted outbox, media tickets | Preserve keys.json and current IDs. For a new empty environment only, release.ps1 keys creates independent crypto.randomBytes(32).toString(base64) values without printing | Local generation, four distinct 32-byte base64 keys | API all four; identity only OUTBOX; general TOKEN_HASH/OUTBOX/ASSET; RUN_TIME SECRET | Parser validates format, role-specific boot checks; existing encrypted records must remain readable |
| PRIVATE_TESTING_PASSWORD | Existing shared staging gate | Preserve .private/private-access.json; for a genuinely new gate release.ps1 private-access generates 32 random bytes as 64 hex characters | Local generation | API RUN_TIME SECRET and Vercel branch Preview Sensitive; never NEXT_PUBLIC | Browser challenge, cookie-only new tab/reload, no credential in response |
| RESEND_API_KEY | Email sending; current replacement already saved | Resend ? API Keys ? Create API Key; name allied-staging, Sending access, restrict domain to notify.alliedautotech.com; copy once directly into ignored backend/.env | sending_access for that one domain | Identity/general workers only, RUN_TIME SECRET; not API/Vercel/build | Designated-recipient send, provider result + actual inbox headers; restricted key cannot list/manage domains |
| RESEND_FROM_EMAIL, RESEND_REPLY_TO_EMAIL | Branded sender and customer replies | Verified domain above; From full display address; Reply-To support@alliedautotech.com | Ordinary configuration | Both sending workers RUN_TIME; local backend/.env | Inspect received From and Reply-To; actual Group delivery test separately |
| DEPARTMENT_INFO_EMAIL, DEPARTMENT_SALES_EMAIL, DEPARTMENT_SUPPORT_EMAIL | Enquiry routing | Existing Workspace Group addresses, no credential | Ordinary configuration | API RUN_TIME; local backend/.env | Mock route coverage; live tests only designated recipients, not Groups |
| STAGING_EMAIL_ALLOWLIST | Prevent staging mail reaching customers/Groups | Initially only alliedautotechltd@gmail.com; exact lowercase comma-separated addresses | Ordinary safety config | API and sending workers consistently | Non-allowlisted request is blocked; controlled worker test received |
| OBJECT_STORAGE_ACCESS_KEY_ID, OBJECT_STORAGE_SECRET_ACCESS_KEY | Existing private Spaces media | DO ? Spaces Object Storage ? existing bucket allied-autotech-staging-5ae8fa4d ? access keys; preserve existing bucket-scoped runtime pair | Read/write objects on this bucket only; no full-account key for runtime | API/general worker RUN_TIME SECRET | Existing object upload/read/delete test; CORS/upload/browser checks |
| OBJECT_STORAGE_ENDPOINT/REGION/BUCKET/FORCE_PATH_STYLE | Spaces addressing | Existing lon1 bucket; endpoint https://lon1.digitaloceanspaces.com, region lon1, path style false | Ordinary config | API/general worker | Signed upload and restricted reads |
| DIGITALOCEAN_ACCESS_TOKEN (or existing doctl context) | Operator deployment, registry push and resource inspection | DO ? API ? Tokens ? Generate New Token ? Custom Scopes. Use existing allied-autotech-staging context when valid; expire/rotate deliberately | app:read/update plus required regions:read, sizes:read, actions:read; registry:read/update and required dependencies for push; account/project/database read for preflight. No resource-create/delete scopes merely to redeploy | doctl protected user configuration, NOT application env or image | doctl account get; read existing app and registry; reviewed update only |
| Temporary registry credentials | Docker push/pull | release.ps1 push invokes doctl registry login with one-hour expiry; uses existing registry | Registry push only for operator; app integration pulls image digests | Docker credential store; never source/env/build args | Push immutable SHA tags, inspect remote manifest digest |
| Vercel CLI OAuth token | Existing frontend Preview deployment | vercel login official device flow; use michael-enochs-projects-3da06943/allied-autotech | Existing project/team deployment access | CLI user auth store, not frontend env | whoami, project/branch environment, Preview deployment READY |
| Cloudflare API token (optional; not currently configured) | DNS automation only if desired | Cloudflare profile ? API Tokens ? Create Token ? Edit zone DNS; Zone Resources include only alliedautotech.com | Zone DNS Edit, Zone Read for this zone | Operator secret store, not application runtime | Read zone and specific records before patch; manual dashboard is sufficient today |
| PAYSTACK_SECRET_KEY (deferred) | Future test payments | Paystack dashboard ? Settings ? API Keys & Webhooks, Test Mode; obtain sk_test key and set exact backend webhook + frontend callback | Test account only | API/general worker RUN_TIME SECRET; PAYSTACK_MODE=test only when approved, live flag false | Test initialization, webhook signature/replay and reconciliation; no live payment |
| MONNIFY_API_KEY, MONNIFY_SECRET_KEY, MONNIFY_CONTRACT_CODE (deferred) | Future sandbox payments | Monnify sandbox dashboard ? Settings ? API Keys & Contracts; set sandbox callback/webhook for this backend | Sandbox account only | API/general worker, secret keys encrypted; contract ordinary config | Sandbox auth/init and signed webhook tests; mode remains disabled now |
| TERMII_API_KEY, TERMII_SENDER_ID, TERMII_BASE_URL (deferred) | SMS | Termii dashboard ? API settings / Sender IDs; use account-assigned HTTPS API host and approved sender | SMS sending for account; funded messages require separate purchase approval | General worker only, API key SECRET; exact phone allowlist | Controlled designated-phone send after approval; no SMS now |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (optional) | Contact-page embedded map | Google Cloud Console ? chosen project ? APIs & Services ? Credentials ? API key; enable/restrict Maps Embed API and exact staging/production HTTP referrers | Maps Embed only; browser-visible, restricted key | Frontend/Vercel branch build setting | Embed renders with allowed origin; existing external map link works without key |
| GitHub Actions deployment secrets | Not required by existing workflow | Existing workflow runs frontend checks only. New redacted secret guard uses checkout/read access and no cloud credentials | contents:read | No DO/Resend/Vercel keys in Actions today | CI logs/checks; do not invent an unreviewed deployment workflow |

Current monthly resources stay within the approved plan: API $10, workers $5 + $5, managed PostgreSQL $15.15, registry $5, Spaces $5 = $45.15/month before tax/overages. Vercel Pro is separately user-purchased. No resizing, extra database, new paid mailbox seat or subscription is included in this work. Existing registry capacity must be checked before a push that could cause storage overage.

## Secret audit and historical cleanup

Current-file guard scans tracked plus non-ignored working files and only reports types/paths. Ignored local credentials were inspected by variable names/presence, never printed; they remain outside Git and images. API/worker Docker contexts exclude .env*, private ops, logs and keys. Vercel upload excludes backend and private files. Public frontend variables contain no provider/runtime secrets. Generated environment examples are intentionally non-deployable placeholders and now explicitly allowed by .gitignore.

Full available Git history scan found a Resend API key in backend/.env.example, in patches for commits **177e335e2196af1a7e3e6f549a1bb700607d6f25** and **8a7fa077567f19146fd76fec928b1246eee0413b** (introduction/removal history). The current local key differs. Current-file cleanup does not remove historical exposure. Revocation is pending user confirmation. No raw key is printed in this document or scan. The scan streams patches after the prior scanner failed at its 100 MB buffer limit. Pattern scanning cannot guarantee that every unknown credential format is detected.

Affected local/remote branches containing the introducing commit: master; deploy/private-testing-20261017; feat/workforce-dashboard-access; remote origin/michael-enoch-define-user-goals. origin/HEAD points at the affected default branch. No affected tags were returned by the current local ref inventory; fetch/verify all remote refs again before any rewrite. This audit covers locally available history, not inaccessible forks or provider caches.

**Prepared procedure only ? do not execute until the user explicitly approves this exact history rewrite and coordinated branch updates:**

1. Revoke the old Resend key first; update/verify valid replacement without deleting encryption keys. Record revocation time/key identifier privately.
2. Freeze pushes, notify collaborators through an authorised human, preserve a restricted encrypted mirror backup, and record old remote branch tips.
3. In a fresh separate mirror clone of Otto-space/allied-autotech, install/use git-filter-repo. Put the exposed literal in an access-restricted replacement file using secure local extraction, not chat/shell arguments. Replacement line format is `literal:<exposed value>==>REDACTED_REVOKED_RESEND_KEY`; do not commit this file.
4. Run `git filter-repo --replace-text <absolute-private-replacement-file>` in that mirror only. This removes the matching content while retaining unrelated historical env example fields. Re-run the redacted scanner over every branch/tag and compare code trees and rewritten refs.
5. After explicit approval of the rewritten ref mapping, update only affected remote refs with recorded expected old tips using `git push --force-with-lease=refs/heads/<branch>:<old-tip> origin <new-tip>:refs/heads/<branch>`. Do not use an unreviewed blanket --mirror push. Coordinate branch protections and provider support/cache cleanup if needed.
6. Collaborators fresh-clone or carefully rebase unpushed work onto clean history; never merge the old exposed history back. Recreate worktrees and update CI/deployment provenance references where necessary. Preserve databases and existing running images throughout.
7. Scan the new remote refs again, confirm key revocation and document the remaining fork/cache limitations. Deleting the key from Git does not revoke it.

Provider rotation guide: Resend API Keys ? revoke identified old key; create restricted replacement only when needed. DO API ? revoke/replace operator token then reauthenticate named doctl context; do not put token into components. Spaces ? replace bucket-scoped key on API/general worker, verify upload/read then revoke old pair. Vercel ? Account Settings ? Tokens/authorised applications for manual tokens/OAuth; reconnect CLI after revocation. Cloudflare ? My Profile ? API Tokens ? roll/revoke scoped token. DB password rotation requires coordinated runtime/worker/migration secret updates and connectivity checks. MFA/outbox encryption and token hashing keys require a separately reviewed compatibility/re-encryption/session plan, not casual replacement.

## Validation and release boundary

- 81 focused unit tests passed: sender/Reply-To validation, routing, encryption, staging recipient restrictions, claim ownership, retries, stable provider idempotency keys, provider timeouts and process configuration.
- 20 deployment-spec and isolated PostgreSQL privilege tests passed. The test created its own disposable container; no application/shared database was reset or touched for assertions.
- Source TypeScript check passed with declaration emission disabled. The existing Windows dependency junction causes unrelated inferred-declaration portability errors under the normal declaration configuration; the real Docker build must validate the ordinary build in its Linux context.
- Current-file secret scan and full history results are reported separately; the historical scanner correctly exits nonzero for the exposed old key.
- Actual provider send accepted; inbox receipt and authenticated message headers pending. Department-wide live delivery not tested.
- No schema/migration changes were made. Existing 17 October managed backup restore rehearsal remains the recovery evidence: separate temporary cluster verified and deleted. Check current automated backups before rollout; run the existing read-only deploy db:check gate. No new restore or migration is implied by passing email unit tests.

For exact loading precedence, all variable classifications and the per-component scope matrix see [runtime-environment-matrix.md](runtime-environment-matrix.md). For image build/push and guarded deployment procedure see [digitalocean-staging-release.md](digitalocean-staging-release.md). Preserve immutable image digests and record the actual deployed commit; source preparation is not deployment.

## Official setup references checked

- [Google Workspace on Cloudflare](https://developers.cloudflare.com/dns/manage-dns-records/how-to/set-up-google-workspace/) ? preserve Google mail records; root Email Routing conflicts.
- [Cloudflare DMARC Management](https://developers.cloudflare.com/dmarc-management/) ? report setup and policy review.
- [Resend API permissions](https://resend.com/changelog/new-api-key-permissions) and [sending API](https://resend.com/docs/api-reference/emails/send-email) ? domain-limited sending access, From and Reply-To.
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) ? provider duplicate protection has a retention window.
- [DO token creation](https://docs.digitalocean.com/reference/api/create-personal-access-token/) and [app:update scope dependencies](https://docs.digitalocean.com/reference/api/scopes/app/update/) ? custom scopes and required read scopes.
- [DO App Spec](https://docs.digitalocean.com/products/app-platform/reference/app-spec/) ? component environment scope and encrypted secrets.
