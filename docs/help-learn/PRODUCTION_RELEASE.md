# Help, Learn and Practice production release

26 October 2026. The owner's subsequent explicit production instruction supersedes
the original brief's local/test publication boundary. Phases 0-3 are deployed;
generative AI and Phases 4-5 remain outside this release.

## Frozen runtime and actual deployment

- Runtime source: `adef02f9d7d0d23818b8dbfcae9e938a27a40ee4` on
  `feat/help-learn-practice-20261026`, reused `allied-shop-vehicles-r2-20261025`.
  Later documentation commits do not change this frozen runtime.
- Merged the actual preceding production source `a28753ab20773b61e4c177f62f222691824c8bf7`
  before release, preserving its fitment and product-media implementation. The
  separate pending staff-revision/customer-table branches and unrelated worktrees
  were not included or overwritten.
- DigitalOcean app: `6b13a247-a3b2-4354-9b9c-dedc185324f8`;
  deployment `1dbceb73-075e-4f41-bd76-deb3daf71354`, ACTIVE.
- Vercel: `dpl_EqRCL8GvHPvwXxMB2brqSgtdYKcD`, READY. Both
  `alliedautotech.com` and `www.alliedautotech.com` point to this exact deployment,
  independently verified through the management API after promotion.
- Entry: <https://www.alliedautotech.com/learn>.
- Production frontend build flag `NEXT_PUBLIC_HELP_LEARN_ENABLED=true`;
  API-component-only flags `HELP_LEARN_ENABLED`, `HELP_LEARN_GUIDES_ENABLED` and
  `HELP_LEARN_PRACTICE_ENABLED` are true. Public catalogue reports AI disabled.
  Checked component flags and deployment progress at `2026-10-26T12:46:29.799Z`.
- Existing browse/enquiries launch mode, payment-provider restrictions, capacity,
  secrets, worker configuration and operational permissions were preserved.

Four immutable component digests:

| Component             | Digest                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| API                   | `sha256:680ac8830fc5f4f94598591b7c6862fa2d62630c92c0ae00fe1df1c8eea38745` |
| Identity worker       | `sha256:9a7ba61cba07641ab4b5781a4fafac2a8137313987cc8a324d29c3b516509f51` |
| General worker        | `sha256:83b975d682e0cf571f938189eca115e7e306b37c14ddf2ce07eb1a198a6ac295` |
| Migration/check image | `sha256:f3ae1a7fb078e7eb718f135cddcf2bbbd6d27648ef0ee95770ab6a9710ecd662` |

## Verification on the merged source

- [Frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40323084248):
  passed with the learning flag enabled, locked Next 16.4.3, 158 test files and
  **1,036 tests**. Production dependency audit: **0 vulnerabilities**. The install
  reported three development dependency findings (two moderate, one high); this is
  not a claim that all dependencies are free of findings.
- [Backend database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40323084306):
  passed, including enabled-learning integration coverage in the isolated Docker
  database namespace. No application database was used for these tests.
- [Redacted repository secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40323084347):
  passed.
- Merged-source local regression: 26/26 learning/product-media/image-order/media
  validation cases passed against the task's newly isolated native `_ci` database
  and restricted runtime role. OpenAPI/routes checked: 364 paths, 424 operations.
- Deployment specification tests: 32/32 passed. Packaged image/database contracts:
  10/10 passed, covering non-root execution, secure CA, application imports and
  native dependencies, empty isolated replay of 71 migrations, drift/pending
  rejection and a separate synthetic restore. Owned Docker test resources cleaned.
- Earlier implementation evidence, including 77 backend checks, 1,032 frontend
  checks and 18 compiled-browser cases, remains in IMPLEMENTATION_STATUS.md. Those
  are local milestone results; they are distinct from the merged-source CI above.

Read-only production API probes at `2026-10-26T12:40:51.302Z`, no cookies or
operational submissions, base `https://api.alliedautotech.com/api/v1`:

| Path                                         | Actual status / evidence                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/health/ready`                              | 200                                                                                                               |
| `/public/learning/catalogue`                 | 200; five public articles, public audience, guides/practice enabled, AI disabled, browse/enquiries mode, no-store |
| `/public/learning/articles/finance-meaning`  | 404; private article not exposed                                                                                  |
| `/public/learning/guides/own-request`        | 404; private guide not exposed                                                                                    |
| `/learning/catalogue`                        | 401; authenticated catalogue requires a session                                                                   |
| `/public/learning/scenarios/corolla-fitment` | 200                                                                                                               |

Frontend verification for this release used Vercel deployment/alias management APIs.
No post-deployment frontend page fetch or hosted UI automation was performed.
Authenticated production-role journeys, physical phones/keyboards, full screen-reader
acceptance and production UI screenshots remain unverified. Local synthetic browser
and accessibility evidence does not establish those hosted outcomes. Practice
isolation has local/integration evidence; no production business records or messages
were submitted to test it.

## Database and recovery boundary

No Prisma/schema/migration changes between preceding runtime `a28753ab` and this
release. No production schema changes, data repair or SQL migration was run by this
task. The existing predeploy job still runs the read-only database safety checker;
provider deployment steps for that job report SUCCESS. Historic log retrieval did
not expose check output, so this is provider job evidence, not a new captured SQL
inventory or restore rehearsal.

Target identity was verified privately: production database
`allied_autotech_production`, managed PostgreSQL 18 cluster
`fa393215-a10f-4c52-9a83-7b9e8b52af1b` (legacy cluster name
`allied-autotech-staging-db`). Credentials/connection strings are excluded here.
The production runtime/migrator identity, verify-full TLS and existing grants were
preserved; staging-name alone was not used to establish a safe target.

Eight managed off-device backups were present; latest `2026-10-26T05:22:11Z`.
Provider documentation specifies encrypted storage/transport, daily backups and
seven-day point-in-time recovery:
[features](https://docs.digitalocean.com/products/databases/postgresql/details/features/),
[restore procedure](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/).
The existing separate logical restore rehearsal completed
`2026-10-25T18:03:19.180Z`, with original row hashes and migration ledger preserved,
71 final migrations and no source writes. Its retained archive checksum was
recomputed and matched
`064b89b07451256356be6167001167e2d3c7f55766623afd0f6e8730b381191a`.
No fresh cloud dump, physical PITR exercise or new managed database was created in
this task. The new packaged synthetic restore above is a separate test, not a
substitute claim of fresh production recovery acceptance.

## Retention, cleanup and next checkpoint

Retain preceding runtime `a28753ab`, backend deployment
`caeac741-805b-47a5-bb2d-d9e703cdff77` and Vercel
`dpl_CucTTefbZ71ApHiWsYA8P9JrPoH9` as the immediate rollback. Before rollback,
recheck current aliases/deployment and any intervening release. Schema remains
compatible at 71 migrations; no database downgrade/reset is needed or authorised.
Learning can be disabled with the three API flags; frontend flag changes require
a new production build. Keep the existing database/release safeguards in either path.

Removed only the four task-created, never-deployed local image references for
superseded source `bb9dea4d8f26c6293a3b2f430cacd6212832bd42`, after exact manifest,
revision-label, tag and container-reference checks; no forced removal. Final four
release images remain present. All 13 existing containers and the same 14 data
volumes were retained. No cache pruning, registry deletion, database deletion or
Docker/WSL reset. Images went from 71 / 12.17 GB to 67 / 12.14 GB; warm build cache
remains 147 entries / 7.574 GB. Host C: measured 29.81 GiB before and after this
bounded cleanup; no physical disk-reclamation claim. Reserve checks passed; this
measurement is not a machine-wide space guarantee.

Release receipts are retained in the ignored protected operations directory, with
only explicit safe projections included here. Source and unrelated uncommitted
work are preserved. The main checkout tracker receives an append-only update.
Site-completion Item 6, business-policy decisions and the broader dashboard/home
work remain open. Next acceptance is actual authorised-role/device review; AI and
unselected training/reporting/CMS scope remain deferred.
