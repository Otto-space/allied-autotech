# Admin redesign release audit — 22 October 2026

## Verified cause

Direct, authenticated read-only provider inspection confirms that the canonical
website serves a different release from the current redesign branch. This is a
source-version difference; a browser-cache problem has not been established.

| Item                                   | Verified value                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Canonical frontend                     | `https://alliedautotech.com`                                                                                |
| Active Vercel deployment               | `dpl_FvauJmGHUenbBtHfwibnVtjvguMw`, READY, Production                                                       |
| Frontend source                        | `f32b529c112941d2015b745740abb56d4c21f04c`                                                                  |
| Release branch                         | `deploy/public-browse-20261021`                                                                             |
| Current redesign source                | `cafd28f0a0f4a05769e6f20249377f31cac8322c`                                                                  |
| Active production API deployment       | `f18e29ee-4c53-4c4f-91cd-6008ccf1445b`                                                                      |
| Production API image source            | `7acb19e1d6e505cb14abdf82674d6aa654e1c51b`; active image digests match the production release record        |
| Production API                         | `https://api.alliedautotech.com`                                                                            |
| Configured automatic production branch | `master`; the active release was explicitly deployed from the release worktree                              |
| Latest redesign Preview attempt        | `dpl_5u23gavQCdMibK9jmqDbTHNy2nAM`, CANCELED; this does not establish a build failure or production release |

Provider inspection on this date supersedes the older staging-only deployment
records. The production release deliberately excluded the newer workforce branch.
Staging's application is archived; its data is retained. Re-enabling it would
change the existing resource allocation and is not part of this diagnostic work.

## Page coverage

The live source register records **68 locally accepted milestones**, through
vehicle stock. The redesign source records **109**, through managed workforce
orders. These counts describe recorded local acceptance, not authenticated hosted
acceptance of every page.

| Area                                                                                          | Comparison with live source                                                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin `/admin` overview                                                                 | Overview component, route and overview stylesheet are identical between the compared commits; the shared shell has later changes. |
| Product-category detail; orders and aftercare; inventory; promotions; vehicle stock directory | Already present in the release baseline. These are not all missing redesigns.                                                     |
| Vehicle creation/detail, inspections and vehicle sales                                        | Later redesign/acceptance work remains to be integrated.                                                                          |
| Customers, staff support conversations, privacy and review moderation                         | Later redesigned management pages are missing from the live baseline.                                                             |
| Payments, invoices, refunds, exceptions and disputes                                          | Later redesigned management pages are missing from the live baseline.                                                             |
| Staff, invitations, branches, audit, processing jobs and owner policies                       | Later redesigned management pages are missing from the live baseline.                                                             |
| Managed workforce pages                                                                       | Later implementation is missing; compatible backend contracts and an additive workforce migration are required.                   |
| Central owner decision checklist                                                              | Proposed consolidation; do not present it as an implemented feature.                                                              |
| Managed workforce finance                                                                     | Code is present in the redesign branch; its final page-acceptance record is unfinished.                                           |

The unauthenticated canonical `/admin` request returned 401. This is consistent
with the perimeter gate and is not a visual check of the owner's signed-in page.
No owner password, MFA code or authenticated owner session was used.

## Prepared integration

- Isolated candidate: `C:/Users/PC/.codex/worktrees/allied-admin-redesign-20261022`.
- Branch: `release/admin-redesign-20261022`.
- Base: `4b2e60d`, including the production release's later onboarding and routing records.
- Merge source: `cafd28f`, the current redesign branch.
- Resolved conflicts retain production signed forwarding, private access,
  enquiry-only launch restrictions, approved inbox routing, and guarded migration
  recovery alongside the redesigned pages and contracts.
- Existing source workspace and unrelated changes remain untouched.
- One additional migration is required relative to the live baseline:
  `20261018140000_workforce_access`. It adds workforce tables and work-order fields;
  no applied migration is edited.

## Verification status

The integrated source has passed the local checks below. Release packaging and
production-target verification remain open. It has **not** been promoted,
published, or applied to a shared database by this task.

- A new isolated PostgreSQL 18 container was created for this task.
- Confirmed target: `127.0.0.1:62471/allied_admin_redesign_20261022_ci`, environment `test`.
- The database was verified empty before replay.
- Prisma client generation, all 60 migrations, schema comparison and `db:check` passed.
- OpenAPI export/validation, mounted-route coverage, backend TypeScript,
  script TypeScript and lint passed.
- All 390 backend unit tests passed; the real PostgreSQL missing-column rejection
  and transaction rollback test passed, followed by a clean `db:check`.
- All 12 distinct workforce access scenarios have passing evidence (11 in the
  initial run; the remaining case passed after correcting a stale notification
  assertion). Tests used a newly created restricted runtime role with no database
  or table ownership, schema creation, TRUNCATE, superuser or role-creation rights.
  Personal notification access is explicitly allowed; notification export and
  legacy operational paths remain denied. No application permission was loosened.
- Frontend lint/type checks, all **889 unit tests**, the production-mode
  browse/enquiries build, and runtime dependency audit passed.
- **17 focused browser scenarios passed** across customers, payments, branches,
  workforce overview and workforce finance. Coverage includes filters, cursor
  paging, reload, selected-detail return, denied roles and accessibility checks.
- Browser plugin was unavailable; existing Playwright tests used Microsoft Edge
  against the built local application with synthetic API fixtures. This is not
  authenticated production acceptance or proof of all backend mutations.
- Six additional native desktop/mobile captures of customers, payments and
  branches passed page-title, meaningful-render, overflow, overlay and page-error
  checks. They and the workforce-finance desktop/mobile captures were inspected.
  Controls and records reflowed without clipping; no application errors appeared.
- Formatting issues from Windows checkout line endings and seven existing/generated
  files were corrected without changing applied migration SQL. Focused formatting
  checks and Git whitespace checks passed.

The first frontend unit attempt mistakenly inherited `NODE_ENV=production` and
the proxy signing key from the external test runner. That caused React test-helper
and request-scope failures. Correcting the runner produced the complete passing
889-test run; the production build separately used the proper launch settings.
These failed attempts are retained in local logs and are not represented as passes.

Example local captures (synthetic data):
[customers desktop](C:/Users/PC/.codex/allied-redesign-customers-1440-20261022.png),
[customers mobile](C:/Users/PC/.codex/allied-redesign-customers-430-20261022.png),
[payments desktop](C:/Users/PC/.codex/allied-redesign-payments-1440-20261022.png),
[branches mobile](C:/Users/PC/.codex/allied-redesign-branches-430-20261022.png).

No production migration, backup, restore rehearsal, account change, public-gate
removal or hosting-resource change was performed. Historical restore evidence
must not be represented as a new restore test of this candidate.

## Release requirements

1. Finish candidate checks, including merged security/launch behavior, affected
   page rendering and role boundaries. Preserve separate unfinished page gates.
2. Verify the actual production database target and migration history with the
   dedicated operator credentials; reconcile pending migration and current
   backup/recovery evidence through the repository's supported workflow.
3. Prepare immutable compatible API/worker/frontend artifacts and a rollback
   plan that preserves database compatibility and existing data.
4. Promote only the reviewed release. Preserve private access and disabled live
   transactions; redesign deployment does not authorise a public launch.
5. Verify the canonical deployment identity and authorised hosted admin flows.

Provider lookup references: [Vercel REST API](https://vercel.com/docs/rest-api)
and [DigitalOcean Apps API](https://docs.digitalocean.com/reference/api/reference/apps/).
