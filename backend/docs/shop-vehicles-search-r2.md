# Shop and Vehicles, revision 2

Implementation source: `feat/shop-vehicles-r2-20261025`, starting at `b45513f1`.
This combines the restored homepage with deployed backend `ff42b0e2`; unrelated
work in the homepage/audit and other worktrees is retained. Provider inspection
confirmed frontend `dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU` READY and backend
`f9239c36-d4b7-4ef0-b8ba-479cda926a13` ACTIVE before implementation.

Released 25 October 2026: backend runtime `91455d10`, deployment
`264c3f8e-324d-42bd-86cb-0dffa2eb9f19` ACTIVE; frontend reviewed tree `cfba360d`,
deployment `dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe` READY on main/www. The audit
release `8b5fe871` was merged without changing its homepage, and the immediately
preceding live frontend `dpl_5vyykAdQnDsAshfCKRU9KNkePJgb` is retained for rollback.
This frontend candidate was uploaded immediately before its matching file tree
was committed; the commit did not change those uploaded runtime files. Backend
images were built and pushed from a clean recorded checkout.

## Contracts established before implementation

- Vehicle enquiries: `vehicleEnquiryIntent` is `LISTING` or `REQUIREMENTS`.
  Legacy requests with a listing and no intent persist as LISTING without changing
  their request body or idempotency hash. Legacy stored
  null intent with a listing remains valid. REQUIREMENTS explicitly forbids a
  listing; LISTING requires a currently public listing. Invalid references never
  turn into sourcing enquiries. Other enquiry-type invariants are preserved.
- Requirements routing reuses the existing public branch choice: an explicit
  active branch, or the sole active branch. No arbitrary fallback among multiple
  branches. Listing intent continues to enforce the listing's branch. Existing
  assignment, branch and workforce template scope governs queue visibility.
- Product families: nullable controlled REPLACEMENT_PART / ENGINE_OIL; null keeps
  existing shared products unchanged. No inferred backfill. Initial oil contract:
  recorded SAE viscosity grade and positive pack volume in explicit millilitres;
  these are label data, never fitment or approval evidence. Optional manufacturer
  specification/approval authoring awaits an established business data contract.
- Search: all normalized tokens must match permitted fields of the same record;
  ordinary final token prefix from three characters, never identifier/grade prefix.
  Engine oil/motor oil is a controlled family phrase alias; 5W30 and 5W-30 are
  equivalent grades; code suffixes and distinct grades remain distinct.
- Ordering: implicit query sort is best match; implicit browse sort is newest.
  Explicit sorts, including newest, win. Tiers: exact identifier; exact name or
  make/model; all core fields; remaining public description. Stable time/ID ties.
  Changed relevance cursors are versioned and bound to effective query and sort.
  Pages are fresh reads, not a snapshot across requests; fixed-data traversal must
  have no duplicates/omissions.
- Facet options are server-derived public values. Counts, if shown, use the current
  intersection with the requested facet relaxed; never count the visible page.
- Transfers contain bounded public criteria, both kobo budget limits formatted in
  naira, and no private vehicle identity. No automatic submission.
- Same-context drafts restore edits. Different-context conflict offers Keep current
  draft / Start this enquiry, retaining both; a resume action returns to the prior
  draft. Context comparison is deterministic and principal/session scoped. No merge.

## Acceptance and evidence

| Batch              | Meaningful fixture acceptance                                                                                                                                            | Status                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Vehicle domain     | Both intents, legacy request/receipt replay, illegal combinations, stale/private listing, branch routing, real persistence, branch/assignment/workforce queue boundaries | Passed real isolated API/database tests; public hosted handoff passed; real authenticated queue sampling remains unperformed |
| Product data/admin | Typed grade/volume, unknowns, family/category compatibility, published visibility, unchanged other products                                                              | Passed isolated persistence and hosted mocked admin authoring/review; no real product was created                            |
| Search             | Cross-field Corolla, exclude Camry, oil alias/grade, exact code/suffix, explicit sort, equal-score/price cursors, private exclusion                                      | Passed isolated PostgreSQL integration and hosted rendering; real public catalogues remain empty                             |
| Handoffs/drafts    | Both budgets, Vehicle requirements, listing reference, review/submission, both conflict choices, resume and identity transitions                                         | Passed mocked review/submission and draft checks; real editable prefills passed without submission                           |
| Rendered quality   | 360/390/768/1024/1440, keyboard, modal focus, empty/no-match/category-empty/error, history and stale requests                                                            | 18 hosted fixture cases, 2 real candidate cases, and 2 real production cases passed                                          |

All persistence fixtures require a newly created isolated `_ci` database. External
mail/SMS/payment delivery stays disabled. No production fixture seed or real enquiry.
Schema changes require forward migration, generated client, empty replay and
`db:check`; rollout retains backup/recovery and least-privilege release gates.

Verification: all 70 migrations replayed into a newly
created loopback `_ci` target; Prisma reported no difference. Final `db:check`
passed with 70 migrations. Eight focused backend files passed 57 checks; the
separately enabled physical missing-column/rollback schema-guard test passed 1/1.
Backend typecheck/lint passed; route coverage matched 408 mounted operations.
The final frontend production CI passed all 1,003 unit tests, lint, TypeScript,
formatting and optimized build with the locked Next 16.4.3 release. The local warm
build used existing Next 16.3.8 dependencies; no dependency installation was made.
The final production dependency audit returned zero vulnerabilities in every
severity. Backend CI passed on `3300eb19`; its backend tree is identical to image
source `91455d10`. Frontend CI passed on `cfba360d`.

Automatic approval review rejected local Next server startup with “blocked by
policy”. No alternative local startup was attempted. All rendered acceptance was
performed on hosted candidates and production using the existing Edge/Playwright
installation. Screenshots were inspected and the inherited oversized radio style
was corrected. This is browser automation, not physical-device or screen-reader
certification.

## Migration and query implementation

Five forward migrations add nullable intent/family/label fields, enforce enquiry
and oil invariants, and maintain derived public search documents/brand keys.
Triggers cover old application writers and category/vehicle name edits. Backfills
recompute search documents and normalized brand keys only; no family, suitability,
approval, stock, price or business timestamps are inferred. Applied migrations
are unchanged. Application rollback keeps these compatible migrations and an
up-to-date migration artifact; rolling back application code does not roll back
database history or permit an older migration runner to ignore newer migrations.

Ordinary searches use ALL-token cross-field matching and bounded rank-tier reads;
identifiers retain punctuation and suffixes. Existing literal `%`, backslash and
quote queries use escaped literal public-field matching for compatibility, rather
than dropping those symbols and broadening results. Option lists use the complete
public result scope with the requested facet relaxed; family relaxation also clears
its dependent typed fields. They return bounded choices and cursors, not counts.

Oil grade is an SAE viscosity label; pack volume is stored in millilitres and shown
with explicit units. Neither is a manufacturer approval or a fitment decision.
The [Shell technical sheet](https://www.epc.shell.com/DocumentManagement/BlobDocumentDownload?DocId=100863412)
was consulted to distinguish grade from separate specifications/approvals; this
does not establish Allied's stock or authorise an approval claim. Optional oil
specifications/approvals remain outside this batch pending the business contract.

Draft form values stay in the existing principal-scoped session storage. The new
registry tracks context/choice references only. Start/resume never deletes the
other form draft. Browser-storage failure is explicit and blocks switching away
from potentially unsaved work; refresh persistence cannot be guaranteed then.

## Derived-field preservation and rollout plan

The conservative migrator rejects arbitrary UPDATE statements. These three exact
catalogue SQL files have a source-controlled SHA-256 review entry in that gate,
identified by migration name and exact LF bytes. There is no environment override.
Changing any SQL byte or using another name refuses that reviewed exception.
The exception is limited to the three complete reviewed files; no general UPDATE
exception is added. Target confirmation, unchanged applied checksums, fresh verified
backup and final `db:check` remain mandatory.

Review: migration 68 writes new derived search fields via self-assignment; its
triggers read only public catalogue inputs and assign NEW search fields. Category
and vehicle triggers refresh derived listing/product fields. Migration 69 writes
only brandKey from the recorded brand. Migration 70 replaces the token function
and refreshes the derived documents. No source column, relation, stock, money,
publication flag, specification, permission, timestamp or customer record is set,
removed or inferred. The only replaced enquiry check is compatible with existing
listing references and the existing anonymous unlisted-product allowance.

Before shared rollout: require fresh encrypted off-device backup/retention/PITR
evidence and an actual separate-database restore rehearsal; apply through the
protected migrator with a fresh exact-target verified archive receipt. Rehearse
the populated forward path in a task-created isolated database, comparing hashes
and counts of every pre-existing non-migration row before/after and after restore,
excluding only the newly derived fields. Stop on any difference, failed check,
lock timeout, drift or backup/restore failure. Never reset or auto-resolve history.
Keep the current application and migration images for recovery; application rollback
retains the additive schema and updated migration-history-aware job artifact.

Isolated populated rehearsal completed 25 October 11:23 UTC: 67→70 through the
protected migrator with a fresh verified custom archive. Actual restore into a
separate newly created `_ci` database matched all original rows. All 225 original
rows across 88 non-migration tables retained identical hashes/counts after the
three backfills; `db:check` reported 70 migrations and no schema difference.
The review gate's 28 unit checks passed, including changed/renamed SQL rejection.
This uses synthetic isolated data, not a production recovery or rollout receipt.

## Business data versus code

Real categories/products, recorded oil labels/volumes, actual vehicle listings and
reviewed fitment evidence are business inputs, not invented fixtures to publish.
New tyre/battery/other-fluid/car-care specialist filters are deferred; existing
shared support remains. Homepage and broader dashboard redesign are out of scope.

## Production verification and remaining business inputs

The protected migrator applied five forward migrations to the explicitly verified
production database with a fresh exact-target backup receipt. Final `db:check`
passed at 70 migrations; all applied SQL checksums and runtime access to new
columns were checked. Runtime credentials remain non-owner, without CREATE,
TRUNCATE, superuser, role-creation or database-creation privileges. No grant was
changed. The initial receipt step correctly hit a runtime-role denial on migration
history; the follow-up used the separate migration role for history and performed
read-only runtime checks. It did not reapply or repair migrations.

A fresh production archive was restored into a separate task-created `_ci`
database. An exported read-only snapshot made the source/archive comparison
consistent despite normal session/rate-limit/worker activity. All 89 table hashes
and counts matched after normalizing timestamps to UTC; all original column values
and existing migration rows were preserved through 65→70 in that isolated restore.
The managed provider showed nine automated off-device backups, latest 25 October
05:22:10 UTC. Provider encryption, seven-day retention and PITR were verified
against its [backup documentation](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/)
and [encryption model](https://www.digitalocean.com/security/shared-responsibility-model-managed-databases).
The new rehearsal was a logical production-archive restore, not a newly provisioned
managed PITR cluster. No claim of zero risk or off-device protection from the local
archive alone is made. Temporary narrow firewall access was restored after each
operation and checked against the original app-only rules.

All four immutable API/worker/migration images were checked against the isolated
schema, then promoted by changing only their digests. The predeploy command stays
read-only `db:check`. Provider inspection confirms all four deployed digests match
the recorded manifest. Read-only production API probes returned 200 for readiness,
product search/options and Vehicle preferences; anonymous staff enquiries returned 401. No real enquiry, customer message, product fixture or payment was submitted.

The final frontend candidate passed 18 fixture browser cases in one complete run:
360/390/768/1024/1440, recorded oil choices/reset, both budgets, requirements and
listing intent, review/mock submission, Keep/Start/resume/reload, principal changes,
storage failure, keyboard error focus/Escape, empty/category-empty/no-match/error,
loading/stale response and explicit-sort history/reload. Sampled main states had no
automated WCAG-tag violations or application console/runtime errors. Two additional
real-data read-only cases passed on the candidate, then both passed again on main
production at 390/1440. Product/Vehicle footer Contact and bounded WhatsApp drafts
now follow applied client-side criteria as well as initial URLs.

Evidence: `%TEMP%/allied-shop-r2-hosted/hosted-suite.json`,
`%TEMP%/allied-shop-r2-live/hosted-suite.json`, public production Playwright output,
`%TEMP%/allied-shop-vehicles-r2/` and `%TEMP%/allied-shop-r2-real/` screenshots.
Protected `backend/ops/digitalocean/.private/shop-r2-*.json` receipts retain the
backup references, restores, checks, manifests, alias inspection and cleanup.
No secrets, customer rows or archives are committed. Representative parameterized
eligibility EXPLAIN plans and all four derived-field indexes were inspected on the
isolated restored schema. Its public catalogues are empty, so those plans do not
certify volume performance. The earlier isolated 10,000-listing API fixture measured
71.8ms inventory/count and 218.7ms complete make-option traversal in one local run;
these are lab measurements, not production service-level promises.

Real products/categories, recorded oil labels and volumes, public listings and
reviewed fitment data remain business inputs. Authenticated real staff/customer
queue sampling, physical devices, other browser engines and full manual
screen-reader acceptance were not performed. Fixture/reference handoffs and real
API authorization tests cover code behaviour; they do not substitute for those
operational acceptances. Other-family specialist fields and optional oil
specifications/approvals remain deferred as described above.

Rollback: retain previous frontend `dpl_5vyykAdQnDsAshfCKRU9KNkePJgb` and preceding
`dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU`, plus backend `f9239c36`/`da8e5b3a` images.
An application rollback must retain migration 70 and the updated history-aware
migration job; do not restore an application database or run an older migration
artifact over newer history. The additive schema is preserved.

Disk hygiene: removed only owned tmpfs PostgreSQL container `e9812340f10b` after
verifying ownership, loopback target, no persistent volume, no unknown databases
and no other consumers. At cleanup Docker containers fell 15→14; concurrent other
tasks were retained. Images stayed 42/11.88GB, volumes 14/1.012GB, useful cache
96 entries/6.798GB. No image/cache/volume prune ran. Current/rollback/base/tool
images, other tasks, warm dependencies, source, private backups and the native
restore rehearsal were retained. C: measured about 23.78 GiB free before final
postflight; this is a point-in-time reading, not a machine-wide quota guarantee.

Final disk postflight passed with 23.74 GiB free on C: (20 GiB reserve).
The earlier 23.78 GiB reading and this later reading are observations during
concurrent activity, not a claim that Docker cleanup reclaimed Windows disk space.
