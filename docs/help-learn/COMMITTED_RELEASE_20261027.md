# Reviewed committed workforce and Allie release (in preparation)

The combined source reached GitHub `master` as `4fbc9cbb`; all three exact-source
checks passed (frontend 40683327555, backend 40683327771, secret guard 40683327553).
Four images were built, passed 41 packaging/specification checks and were pushed.
The matching held Vercel candidate was not assigned to either customer domain.
Native payment regressions passed 92 cases on a separate restricted `_ci` target;
the reviewed fitment suite passed nine more cases on the workforce target. An
extracted predecessor runtime's 89-model schema probe passed against schema 76
without reading business rows or writing data. This supports a recovery
composition using the new read-only migration checker and preceding runtime,
without reversing migrations; full payment-provider recovery remains untested.

Hosted testing then found a Next deployment-query/API-media mismatch, now being
corrected in the frontend. The backend build inputs remain identical to `4fbc9cbb`;
retain those verified images rather than duplicate them for a frontend-only
correction. Reuse requires an explicit zero-difference check of backend source,
and exact-source CI/browser acceptance for the new frontend master commit. No
production migration, backend rollout or custom-domain promotion has run yet.

## Current consolidation checkpoint: 28 October 2026

The owner approved completing integration through `master`, exact-source GitHub
checks, guarded production publication and retirement of finished branches. See
`backend/docs/integration-release-workflow.md`. All remote heads observed during
the review and the unique local feature/release histories have been reconciled;
the old UI prototype and schema-72 frontend rollback are preserved in history
without downgrading the approved current experience. Active or dirty worktrees
remain separate. The owner confirmed that three missing worktree folders were
deleted in their entirety; their Git metadata remains protected for review.

This combined candidate retains the published `552ee418` Shop changes, subsequent
refresh/Help fixes, compact customer history, customer vehicle payment filtering,
legacy compatibility concurrency, missing-page recovery and P0 reconciliation/
payment-session safeguards. Contracts were regenerated from the merged source.
The current backend was re-read as ACTIVE
`79d7a0ac-4e83-4b73-ae46-40af4731a604`; no pending deployment was observed.

There are now **76** source migrations and **72** on that production backend.
Four forward migrations are pending: reconciliation attempts, observation index,
assistant transient state and the reconciliation due projection. A newly created
isolated database replayed all 76 with no schema difference and passed `db:check`.
Backend source/script types and lint passed. Further composition regressions,
exact-source CI, packaging, a fresh separate populated restore/forward rehearsal,
guarded migration and both runtime promotions are still required. Earlier
73-migration candidate checks and held previews below remain historical evidence,
not acceptance of this larger composition or proof it is deployed.

The production backup inspection verified the migration role owns the four
existing financial objects required by the forward changes and that no
reconciliation run is active. Runtime default DML rights were verified without
changing grants. Existing launch, payment, AI and live-support settings remain
unchanged. Full Revision 4 and all 106 route decisions are still incomplete.

The fresh 28 October production archive was restored into a newly created,
loopback-only isolated `_ci` database. The guarded runner made its own verified
target backup, applied all four pending migrations and passed `db:check` with 76
applied migrations. Every original table's row count and hash over its captured
original column list remained equal; new reconciliation defaults/checks and the
due projection were verified against preserved source history. The three assistant
tables were empty. The original app-only firewall was restored and independently
checked. This is a logical restore/forward rehearsal, not a physical managed PITR
exercise or a production migration. Real financial-history fixture coverage is
separate from the production snapshot's actual contents.

Local cleanup removed 50 reviewed superseded Docker images; reported image usage
fell from 13.24 GB to 11.33 GB. Containers, volumes, databases, backups, useful
caches and rollback images were preserved. Host free space barely changed at
that cleanup; it must not be reported as equivalent reclaimed Windows disk space.
A later preflight measured 28.2 GiB free. Narrow cache pruning reclaimed nothing.

The merged composition passed 210 native integration cases across 17 separated
workforce, support, replay, learning and Allie suites using the newly created
restricted-runtime `_ci` target. No existing protected owner's password or
permission was altered. Frontend source types and lint passed after removing an
obsolete CommonJS lint suppression; imported rollback-runbook table formatting
was normalised. The rollback guard's mocked PowerShell entrypoint tests passed;
they made no provider mutation. Exact-source hosted and CI gates remain pending.

The dated observations below describe earlier candidates and must not override
the current combined-source checkpoint.

The owner's later instruction authorises production publication of verified
committed changes before the session limit. This record is a release checkpoint,
not a claim of deployment or complete Revision 4 acceptance.

The release branch `release/allie-workforce-reviewed-20261027` preserves W15
`45f0267b`, the actual current backend source `0fd68980` and current frontend
`42855c0d`. Provider reads on 27 October verified backend
`79d7a0ac-4e83-4b73-ae46-40af4731a604` ACTIVE and both domains on READY frontend
`dpl_JDtwMW41Nk8fxMDP7ak2U6WTwo5h`. These predecessors must be rechecked immediately
before any rollout; another task is actively releasing changes.

Both security/identity fixes and the workshop location/contact updates are retained.
All conflicts except one CSS extraction involved append-only progress records; both
records were retained. The old enquiry-specific picker styles were already moved
into the shared Care picker. Its extraction is retained and its radio accent adopts
the current shared checked-state token. Newer colour, brand, About, Home, mobile
support placement and Contact work remains in place. No worktree was reset and no
uncommitted work from another checkout was copied.

Release gates still required: canonical contracts, merged-source types/lint and
regressions, fresh isolated 73-migration replay, exact-lock CI, four packaged images,
current encrypted managed backup/retention/PITR evidence and a separate populated
production restore/forward-migration rehearsal. Production migration must use the
guarded runner with verified backup and exact target. Keep the predeploy job read-only.
Promote the frontend only after matching backend readiness, worker checks and digest
verification. Recheck both domain deployment IDs afterward.

Preserve existing configuration, permissions, capacities, launch restrictions and
secrets. AI remains off without separately reviewed production provider configuration;
the local evaluation allowance is exhausted. Live human mode is unimplemented and
must remain unavailable. Queued Customer Care remains the reliable supported path.
No real account, message, payment, upload or inventory seed is a release test.

Migration 73 is additive assistant state infrastructure and must not be undone by a
database rollback. The preceding backend checker expects history 72; do not blindly
redeploy it after migration 73. Prepare a forward-compatible recovery composition.
Retain predecessor images/releases and backup/restore evidence. Full Revision 4,
shared staffed transport and all 106 route completion decisions remain open.

## 28 October: verification corrections before publication

The first merged-source run mixed security fixtures and workforce fixtures that
use the same protected singleton owner with different password proofs. Fifteen
workforce write expectations therefore correctly received 403. No owner password,
permission or production rule was relaxed. A separate newly created isolated
workforce target with its own verified synthetic proof passed all 207 cases across
17 suites; the security cases retain their separate evidence. Future combined
runners must preserve that isolation.

One handoff request also exhausted three serialization retries: the PostgreSQL
error log records two Session conflicts followed by an Enquiry conflict on the same
connection. A deterministic three-abort test reproduced the 500. Handoff now has
a bounded five-attempt budget for database-aborted conflicts and returns a
recoverable 503 if that budget is exhausted. Unknown outcomes are never retried;
all other callers retain three attempts. Six HTTP duplicate races, an actual
row-version/lock-controlled snapshot race, forced exhaustion/recovery and the full
29 handoff cases pass, as do eight retry-boundary units. No schema change.

Frontend CI passed all 1,161 units and the locked build, then rejected one blank
line in the merged quality register. Formatting is corrected. The candidate is
being refreshed against the newer live frontend `fbb6565a`; do not publish the
older candidate merely because its images are built. Production still uses the
preceding backend; migration 73 and domain promotion have not run.

The 27 October rehearsal actually restored all original production tables into a
new isolated database, applied migration 73 through the guarded runner, verified
all original row hashes and four new validated constraints, and checked three
empty new tables. The original app-only firewall was restored. That receipt is
now older than 24 hours and must be refreshed before production migration.

## 28 October: current publication and disk checkpoint

Published frontend 9f9311cf on READY dpl_68bNV74wNajB9vW1Ly85nzmmdEvU
was verified on both domains. Release merge 2d96b1e3 preserves its parts-enquiry
wording and the preceding fbb6565a Home, navigation, Privacy and mobile support
changes. Review memory, session revocation and explicit handoff privacy notices
are retained alongside the scrollable dialog body. No production migration, image
push or domain promotion has occurred. Exact-source backend and frontend checks
passed: frontend 40671516921, backend 40671641294 and secret guard 40671516782.

Local packaging and browser replay are paused: C: dropped to approximately
19.4-20.0 GiB free, below the mandatory operation allowance and sometimes below
the 20 GiB reserve. The task frontend typecheck process was stopped; its partial
run is not acceptance. Backend source typecheck/lint and nine session-label units
passed. Automatic approval review rejected deletion of the four previously
approved obsolete .next/dev directories with "blocked by policy"; no alternate
deletion method was attempted. Manual space recovery is pending.

A fresh read-only production inspection verified 72 applied history checksums,
strict TLS, the sole additive migration 73 pending, and the migration owner's
default four DML rights for runtime. The original app-only firewall was restored
and independently checked. The backup role is not a member of pg_read_all_data; a second read-only inspection
verified its existing effective default SELECT grants for future migration-owned
tables and zero unreadable current tables. No grants were changed. Today's
managed backup is 2026-10-28T05:22:10Z; the separate populated Oct27 rehearsal
remains genuine evidence but needs refreshing before production migration.
