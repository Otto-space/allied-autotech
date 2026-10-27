# Admin redesign release audit — 22 October 2026

> The later notification update is now the current release (`6df9386`).
> See [notification release verification](notification-awareness.md#release-verification--22-october-2026).
> The identities below record the earlier admin redesign release.

## Released outcome

The matching frontend and backend release was promoted to the canonical domains
at the verification time recorded below.
This deployment preserves the private testing gate, enquiry-only launch mode,
disabled live payments, existing hosting allocation and existing application data.

| Item                                                   | Verified value                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Website                                                | https://alliedautotech.com                                                    |
| Frontend deployment                                    | `dpl_G8rBxP8ERi8zL45hYGWWW7vDRLTT`, READY, production                         |
| Frontend preview URL                                   | https://allied-autotech-9gir46o5p-michael-enochs-projects-3da06943.vercel.app |
| Source commit for frontend and all four backend images | `a83a14091062d4991c15998636c9802727631166`                                    |
| Release branch                                         | `release/admin-redesign-20261022`                                             |
| Production API                                         | https://api.alliedautotech.com                                                |
| Active backend deployment                              | `6aef7f8e-2824-45bc-b754-7224e1467472`                                        |
| Database migration history                             | 60 completed migrations; post-migration schema check passed                   |
| Hosted verification time                               | 2026-10-22T07:51:26.643Z                                                      |

The provider's active backend deployment and all four immutable image digests
match the release manifest. Vercel's canonical-domain deployment reports the same
source commit. No hosting resources or production environment values were changed.

## Why the changes were missing

Initial provider inspection found frontend commit
`f32b529c112941d2015b745740abb56d4c21f04c` in deployment
`dpl_FvauJmGHUenbBtHfwibnVtjvguMw`, with backend image source
`7acb19e1d6e505cb14abdf82674d6aa654e1c51b` in deployment
`f18e29ee-4c53-4c4f-91cd-6008ccf1445b`.
The newer redesign branch was not deployed there. A browser-cache fault was not
established. An earlier canceled preview was not evidence of a build failure.

The release merges redesign source `cafd28f` into production release base
`4b2e60d`. Conflicts were reviewed to retain signed proxy forwarding, private
access, enquiry-only launch restrictions, approved inbox routing and database
safeguards alongside the redesigned pages and backend contracts.

## Page coverage and limits

| Area                                                                                      | Release status                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin /admin overview                                                               | Its main component, route and overview stylesheet were already identical between the compared sources. Later shared-shell changes are included; this release does not introduce a new main overview design. |
| Product-category detail, orders/aftercare, inventory, promotions, vehicle stock directory | Already present in the previous release baseline.                                                                                                                                                           |
| Vehicle creation/detail, inspections and sales                                            | Later redesign source included in this release.                                                                                                                                                             |
| Customers, staff support, privacy review and review moderation                            | Later redesign source included.                                                                                                                                                                             |
| Payments, invoices, refunds, exceptions and disputes                                      | Later redesign source included.                                                                                                                                                                             |
| Staff, invitations, branches, audit logs, processing jobs and owner policies              | Later redesign source included.                                                                                                                                                                             |
| Managed workforce pages                                                                   | Frontend, compatible backend contracts and additive migration deployed together.                                                                                                                            |
| Central owner decision checklist                                                          | Still proposed; this deployment does not implement that consolidation.                                                                                                                                      |
| Managed workforce finance                                                                 | Code deployed; focused desktop/mobile browser and accessibility checks passed. Its separate overall goal/page-acceptance record has not been marked complete by this release task.                          |

The prior live register had 68 local acceptance milestones; the redesign register
had 109. These are local records, not proof that every role and mutation has been
accepted on production. No owner password, MFA code or owner session was used.

## Validation completed

- Backend TypeScript, script checks, lint, OpenAPI export/validation and mounted
  route coverage passed; **390 backend unit tests** passed.
- A newly created isolated PostgreSQL 18 database passed an empty replay of all
  **60 migrations**, client generation, schema comparison and `db:check`.
- The real PostgreSQL missing-column rejection and transaction rollback test
  passed, followed by a clean schema check.
- All **12 distinct workforce access scenarios** have passing evidence. Eleven
  passed initially; the remaining case passed after correcting a stale notification
  assertion. Personal inbox access is allowed, while export/legacy operational
  paths remain denied. No runtime permission was loosened.
- Frontend lint, types, **889 unit tests**, production-mode enquiry-only build and
  runtime dependency audit passed.
- **17 focused browser scenarios** passed across customers, payments, branches,
  workforce overview and workforce finance: filters, cursor paging, reload,
  selected-detail return, denied roles and accessibility checks.
- Six additional customer/payment/branch captures at 430 and 1440 pixels, plus
  workforce-finance captures, were inspected. No clipping, horizontal overflow,
  overlays or application errors were observed.
- Browser tests used Edge against the built local application with synthetic
  API fixtures. The real API access suite used an isolated database.
- All four Docker images were built from the clean release commit. **10 focused
  image checks** passed, covering non-root execution, CA handling, entrypoints,
  native dependencies, packaged migration rejection and isolated restore/schema
  checks. Secret scanning and whitespace checks passed.
- Formatting checks passed after normalizing checkout line endings and formatting
  the identified files. Applied migration SQL was not edited.

The first frontend unit attempt inherited unsuitable external runner settings,
causing React test-helper and request-scope failures. Correcting that runner
produced the complete 889-test pass. The initial notification test failure was
an outdated expectation. These initial failures remain recorded in local logs.

## Database safety evidence

The confirmed production target was
`allied-autotech-staging-db-do-user-44970995-0.k.db.ondigitalocean.com:25060/allied_autotech_production`,
environment `production`. The cluster's historical name does not make this a
staging database. Strict TLS and separate runtime, backup and migration roles
were used. Existing migration checksums matched; no unresolved migration failed.
The runtime role had no database/table ownership, schema creation, TRUNCATE,
superuser, role creation, replication or bypass-RLS privileges.

Provider inspection found six managed backups, latest
`2026-10-22T05:22:09Z`. The existing encrypted off-device backup and seven-day
PITR configuration and prior separate managed restore evidence were reviewed.
This task also created and verified a fresh dedicated production backup, then
restored it into the **new isolated local database**
`127.0.0.1:62471/allied_redesign_restore_20261022_test`.
The rehearsal restored 82 original tables and 83 rows, advanced migration history
from 59 to 60 through the guarded runner, and verified hashes of the original
columns in every original table remained unchanged. It passed at
`2026-10-22T07:32:25Z`. The production source was not written during rehearsal.
This was a new local restore rehearsal, not a newly provisioned managed PITR test.

The only production schema addition was
`20261018140000_workforce_access`. The previous production schema check,
`npm run db:migrate` with fresh verified backup evidence, and the candidate's
post-migration `npm run db:check` all passed. Production migration finished at
`2026-10-22T07:37:12Z`. New-table runtime DML and backup SELECT privileges were
verified through existing default grants. Existing grants were not altered.
Temporary operator network access was removed; the application-only firewall
was verified again. No application database was reset, truncated, replaced or
restored over. These checks reduce risk; they do not promise zero risk.

## Hosted checks and remaining acceptance

- Canonical API liveness and readiness return 200 after the new backend became
  active. DigitalOcean's packaged pre-deploy database check also succeeded.
- Unauthenticated canonical /admin remains protected with 401.
- Real Edge browser checks at 430 and 1440 pixels confirmed that opening the
  customer admin route without an account session redirects to the sign-in page.
  The form rendered without overflow, page errors or failed script/style/font
  requests. Both screenshots were inspected; no credentials were entered.
- Using only the existing perimeter credential, login and customer/payment/branch
  route HTML and their CSS assets return 200 on the canonical domain. The customer
  stylesheet contains the new record layout. This confirms deployed page assets,
  not access to customer records or an authenticated owner workflow.
- The owner should review the linked management pages after signing in normally.
  Production mutations, real financial transactions and every role-specific
  workflow were not exercised by this release task.
- Vercel still names `master` as its automatic production branch. This release
  was explicitly deployed from the named release branch. Reconcile those branches
  before a later automatic deployment so it cannot supersede the redesign with
  an older source version.

## Rollback and evidence retention

The previous backend image digests, provider specification and deployment identity
are retained in protected local release evidence. The additive migration remains
compatible with the prior application; application rollback must preserve the
database and must not downgrade or remove its data. A rollback was not performed.

Release receipts, backup receipts and provider specifications are outside tracked
source under the protected operations directory. They contain sensitive operational
configuration and must not be copied into public issues or this report.
The original working tree's unrelated changes were preserved. Staging remains
archived and was not reactivated.
