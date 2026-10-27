# Inspector feedback 1 — FAIL

**Inspected Builder commit:** `5a93f5623c229effd1b08d37356f006d1b7ac1cf` (`chore(rollback-guard): [B] prepare verified rollback path`)

## Overall verdict

**FAIL — do not mark this goal complete.** The runbook is careful and well scoped, and the helper has useful immutable deployment/project pins and explicit confirmation. However, the guard does not check for an already active rollback, its pending-deployment query is limited to one page of 20, and the mock tests do not exercise the helper's actual entrypoint or approval/mutation boundary. These gaps leave unsafe/ambiguous production state insufficiently guarded and leave critical behavior unverified.

## Acceptance criteria

1. **Runbook and recovery limitations — PASS.** `frontend/docs/vercel-deployment.md` names the pinned deployment, project ID/name, scope, source SHA and READY prerequisite; directs operator checks for pending deployments and races; documents explicit owner approval, rollback status, deployment identity/alias assignment, public routes, independent backend health and escalation; and plainly limits recovery on Vercel retaining the deployment and being available. It does not claim a rollback restores backend/data or guarantees availability.
2. **Guarded helper — FAIL.** `frontend/ops/rollback-production.ps1` pins the deployment/project/scope/commit and requires `-ExecuteRollback`, `ShouldProcess` confirmation, and exact typed deployment ID. The regular path is read-only. But `Assert-NoPendingProductionDeployments` (lines 138–165) only checks `/v7/deployments` with `limit=20`; it neither follows pagination nor checks for an active/pending rollback operation. A rollback in progress may not appear as a queued production deployment. Thus the helper can proceed through an ambiguous state contrary to the fail-closed requirement. Runbook-only manual checks do not make the executable guard refuse that state.
3. **Alias identity distinct from health — PASS with limitation.** The runbook explicitly states command acceptance/READY is not recovery, requires confirmation of exact deployment/project/SHA, `aliasAssigned` and both domains, then route checks correlated with Vercel request/deployment information and independent backend health. The helper correctly warns that submission is not proof of recovery. The identity/health verification is manual rather than automated; preserve this distinction and ensure the operator can obtain identity evidence from the documented Vercel source.
4. **Parser and mocked/dry-run validation — FAIL (insufficient coverage).** `frontend/ops/tests/rollback-production.Tests.ps1` passed and parses both scripts; the self-test reports seven rejected scenarios and zero mutation calls. Inspection shows it invokes only `Assert-SafePreflight`, not the helper's no-switch entrypoint, `ShouldProcess`/`-WhatIf`, typed-confirmation path, or a mocked mutation boundary. Its mock throws on any rollback command, so the “zero mutation calls” assertion does not demonstrate that the real entrypoint blocks unintended mutation. It also lacks active-rollback, pagination, missing/empty response, and malformed/incomplete-state cases.
5. **`master` automatic-deployment control is pending approval — PASS.** The runbook specifies the proposed `"master": false` `git.deploymentEnabled` entry and says it was not applied and needs explicit approval.
6. **No prohibited actions / preserve original edit — PASS for this inspection.** No production, Vercel, GitHub, branch, project-setting, database or application-data action was performed. The original checkout still reports only its pre-existing `M frontend/app/components/home-hero.tsx`; the isolated worktree contains the Builder artifacts and goal metadata only.

## Focused validation performed

- Ran `frontend/ops/tests/rollback-production.Tests.ps1`: **passed**; PowerShell parser checks and local mocked self-test passed. The test did not contact Vercel.
- Ran `git diff --check 13b5688ce9ecb57d2835b94a342638cfff7bacc3..HEAD`: **passed** (no whitespace errors).
- Reviewed `.goals/production-rollback-guard/goal.md`, root `AGENTS.md`, applicable `frontend/AGENTS.md`, the implementation and tests, deployment runbook, Builder commit diff/history, and worktree/original-checkout status.
- No live Vercel/API/CLI request, production action, credential/secret read, database command or application-data access was performed.

## Required next iteration

1. Extend the helper's fail-closed preflight to detect an active/pending rollback and to exhaustively inspect relevant production deployment pages (or explicitly fail if completeness cannot be established). Do not weaken pins or use a production action to test this.
2. Add isolated mocks that exercise the actual helper entrypoint: default no-switch dry run, `-WhatIf`, declined/mismatched confirmation, and the explicit mutation boundary with a stubbed CLI. Assert the exact pinned deployment/scope arguments and that every non-approved path makes zero mutation calls. Include active rollback, incomplete/paginated list, empty/malformed responses and unknown states.
3. Re-run the focused local tests and `git diff --check`; retain the manual post-action identity and route-health distinction in the runbook.

Do not change the immutable goal, touch production/settings/GitHub, or include Builder implementation changes in the Inspector commit.
