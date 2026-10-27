# Goal: Keep Release and Database Safety Gates Passing

## User Request

Go to source control, make sure it's always passes frontend release checks, backend and database safety checks then push

## Refined Goal

Ensure the repository's frontend release and backend/database-safety gates run and pass for the relevant source-control changes. Preserve or strengthen the existing checks, correct genuine failures without bypassing safeguards, validate using isolated/safe workflows, and push only task-related changes to the current branch's configured upstream. Do not include the already-dirty worktree changes or inspect, stage, or publish private deployment inputs.

## Acceptance Criteria

- [ ] Criterion 1: Frontend release CI runs for the relevant pull request/push and retains its production audit and production-check gates; any actual failure is corrected without skipping or weakening checks. Trigger coverage now includes root `AGENTS.md`; the production audit passed, but production checks failed in two sitemap unit tests (869/871 passed).
- [ ] Criterion 2: Backend/database-safety CI runs for the relevant pull request/push and retains isolated migration replay, `npm run db:check`, and its backend/database tests; no application/shared/production database is reset, modified, or used for tests. Backend typecheck, script check, lint, and 53 safety unit tests passed. Prisma generation was blocked by `DB_SSL_CA_FILE` configuration; migration replay, `db:check`, and integration tests were not run because no isolated PostgreSQL target was verified.
- [x] Criterion 3: Run the most focused safe validations feasible, document limitations, and preserve pre-existing worktree changes and private deployment inputs.
- [ ] Criterion 4: Commit only task-related changes; push is explicitly prohibited for this execution, so upstream/remote CI status will not be verified.

## Scope Boundaries

**In scope:**
- Relevant CI workflow configuration and directly related documentation or checks.
- Running appropriate frontend release and backend/database-safety validations.
- A task-specific commit and push to the current branch's configured upstream.

**Out of scope:**
- Existing uncommitted changes, including frontend email-verification changes, backend owner-provisioning docs, and editor/MCP configuration.
- `backend/ops/digitalocean/.private/inputs.json` and other private deployment inputs or secrets.
- Weakening/skipping checks, altering branch history, destructive database operations, or changing application/database data.

## Applicable Project Conventions

**Quality gate command:**
- Frontend CI: `npm ci`, `npm audit --omit=dev --audit-level=high`, then `npm run check:production` from `frontend`.
- Backend/database CI: follow `.github/workflows/backend-database-safety.yml`, including Prisma generation, isolated migration replay, `npm run db:check`, typecheck, script checks, lint, database-safety unit tests, and isolated PostgreSQL integration tests.

**Commit convention:**
- No enforced repository commit-message convention was discovered; use a clear conventional commit subject.
- Include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

**Guidelines:**
- `AGENTS.md`
- `frontend/AGENTS.md`
- `backend/docs/database-safety.md`

**Rules:**
- Preserve application data. Database tests must use isolated `_test` or `_ci` databases only.
- Database safety validation must follow the documented migration and backup workflow; do not reset or bypass safeguards.
- Frontend changes must follow frontend guidance, including consulting installed Next.js documentation when relevant.
- Do not include pre-existing worktree changes or private deployment inputs in commits or pushes.
