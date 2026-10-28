# Reviewed committed workforce and Allie release (in preparation)

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
