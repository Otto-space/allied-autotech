# Integration, production publication and branch retirement

The owner's 28 October 2026 instruction establishes `master` as the integration
branch. Complete each approved batch through integration, exact-source GitHub
checks and production publication. Do not leave finished changes on abandoned
branches or represent a pushed image as an active deployment.

1. Inspect remote and local heads, registered worktrees and their status. Compare
   actual frontend domain deployments and backend component digests with source.
   Preserve dirty, missing or active worktrees and their recovery metadata.
2. Review unique changes before merging. Resolve conflicts in favour of verified
   current behaviour and approved policies, preserving useful new functionality.
   Historical prototypes and incident rollback compositions must not silently
   replace newer approved implementations. Record such reconciliations.
3. Regenerate canonical contracts, run relevant local and isolated database tests,
   and integrate the reviewed result into `master` without force-pushing. Require
   successful Frontend release checks, Backend database safety and repository
   secret checks for the exact commit. Explicitly dispatch path-filtered checks
   when needed. Fix failures and repeat checks for the resulting commit.
4. Publish only that checked source. Follow database-safety.md and the deployment
   runbooks: forward migration replay, fresh verified backup, separate populated
   restore rehearsal, correct privileges, managed backup/PITR evidence, matching
   packaged images, read-only predeploy, backend readiness and worker checks.
   Prepare a compatible recovery path before a schema change; never undo data by
   reverting migrations. Keep restricted commerce, AI and live-chat flags unchanged
   unless their separate prerequisites and publication approval are satisfied.
5. Hold a production-environment frontend candidate without assigning domains until
   its matching backend is ready. Check rendered representative journeys. Recheck
   provider state immediately before mutation; incorporate a concurrent release
   rather than overwrite it. Verify both apex and www deployment identities after
   promotion and retain exact receipts and honest acceptance limitations.
6. Retire only completed branches whose exact heads are ancestors of released
   `master`, whose changes are deployed and whose worktrees are clean and inactive.
   Recheck remote heads immediately before deleting with an expected-old-SHA lease.
   Preserve branches with dirty/missing/active worktrees or unresolved recovery
   needs, report the reason, and do not use forced branch/worktree removal. Keep
   `master`, release receipts and required rollback resources. Delete verified
   disposable local artifacts under the disk policy, not source or history stores.

This is a gated agent workflow, not an unattended production deployment service.
Do not add credentials to GitHub or change provider production-branch settings as
an incidental shortcut. Existing provider settings may refer to historical release
branches; inspect them before deleting a connected branch. Production publication
does not establish that every route, role, physical device or gated feature passed
acceptance. Keep the full completion tracker and coverage matrix accurate.

The imported `frontend/ops/rollback-production.ps1` is a historically pinned
frontend incident tool. Its mocked tests exercise safeguards, not current runtime
compatibility or a real rollback. Review its immutable deployment/source target,
current backend schema and incident authorisation before any execution.
