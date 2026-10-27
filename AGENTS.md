# Repository rules

Make every change professional, complete and reviewable.

## Database safety — mandatory

- Preserve existing application data. Never reset, drop, truncate, recreate, or restore
  over an application, shared, staging, or production database to fix errors or tests.
  Never use `prisma db push`, `prisma migrate reset`, `prisma migrate dev`, or an
  unreviewed `db execute` against these databases.
- Confirm the actual host, port, database and environment before any database write.
  Do not print passwords, connection strings, backup contents or customer records.
- Treat schema changes as incomplete until a forward migration is committed alongside
  the schema, the client is regenerated, an empty isolated migration replay passes,
  and the target passes `npm run db:check`. Never edit or delete applied migrations.
- Use `npm run db:migrate` to apply reviewed pending migrations. This command must
  verify migration history and create/verify a fresh backup before applying changes.
  Do not bypass its checks or turn startup into automatic migration/repair.
- Stop on drift, failed migrations, changed checksums, a wrong target, failed backup,
  or failed verification. Diagnose and use a reviewed forward fix. Do not mark a
  migration applied/rolled back merely to silence an error.
- Use expand-and-contract changes: add compatible fields first, preserve old data,
  migrate/backfill explicitly and verify it, then retire old fields only through a
  separately approved data-preservation plan. Destructive maintenance requires an
  explicit user instruction for the exact target and operation, a verified backup,
  a successful restore rehearsal and a reviewed recovery plan.
- Run database tests only on newly created, isolated `_test` or `_ci` databases.
  Never repoint tests to the application database or delete real data for assertions.
- Application/worker credentials must not own the database/tables or have schema
  modification, TRUNCATE, superuser or role-creation privileges. Keep migration and
  backup credentials separate. Do not change existing grants without reviewing impact.
- Before any shared/production rollout, verify automated encrypted off-device backups,
  retention, point-in-time recovery where supported, and a successful restore rehearsal
  into a separate database. A local dump or a readable archive index alone does not
  prove recoverability or constitute an off-device backup.
- Preserve these safeguards in Docker, release scripts and direct runtime entrypoints.
  Report exactly which safety checks and restore tests ran; never promise zero risk.

See `backend/docs/database-safety.md` for the supported workflow.

## Site completion continuity

For ongoing site-completion work, read `backend/docs/site-completion-tracker.md`
first. Maintain its current item, evidence, outstanding decisions and constraints.
Work through items individually; do not repeat settled approvals or treat an
optional feature as a launch requirement. Check the recorded release worktree and
current deployment before choosing source for a change.

## Local Docker disk hygiene — mandatory

- Preserve the owner's minimum 20 GiB free-space reserve on C: across all linked
  worktrees. Before substantial writes, run the shared read-only preflight at
  `C:/Users/PC/.codex/scripts/assert-disk-space.ps1`; its default requires 25 GiB
  free, allowing 5 GiB growth above the reserve. Budget larger operations explicitly
  and stop on failure. Reuse existing worktrees and dependencies where suitable.
- Before Docker builds/tests and at task completion, follow
  `backend/docs/docker-disk-hygiene.md`. This applies across linked worktrees.
- Reuse verified suitable images and warm caches. Do not create duplicate builds,
  throwaway builders, image archives or persistent test resources without a need.
- Remove task-created temporary resources and confirmed superseded local images
  and stale build caches when their purpose is finished. First verify container
  references, current/pending releases, rollback requirements and other worktrees.
- Age, dangling status, or "unused" alone never proves an image/cache unnecessary.
  Keep useful current/rollback/base/tool images, recent reusable caches and resources
  belonging to another active task. If usefulness is uncertain, retain and report it.
- No blanket `docker system prune -a`, broad image/container/volume pruning, forced
  image removal, Docker factory reset, or manual Docker/WSL disk deletion. Database
  volumes, backups and application data are outside routine cleanup authority.
- Use explicit reviewed targets and native Docker cleanup, recheck them immediately
  before deletion, and report measured before/after space plus what was retained.
- Follow the local-artifact section in the same document for generated worktree
  builds and temporary editor/test profiles. Avoid full extension/profile copies;
  preserve source, uncommitted work, history, secrets, data and useful current caches.

## Standing UI and UX quality responsibility

Read `frontend/docs/Allied_AutoTech_Continuous_UI_UX_Codex_Prompt.md` completely
and use `frontend/docs/UI_UX_QUALITY_REGISTER.md` for current scope and evidence.
Own frontend, interaction, accessibility and product quality in future relevant
tasks. Work in finite, reviewable cycles: reproduce the highest-impact verified
journey problem, preserve business truth and permissions, improve existing
components, verify rendered interactions and relevant states, and update coverage
and the prioritized backlog. Use WCAG 2.2 AA as the target; distinguish automated,
manual, mocked and hosted evidence and mark inaccessible/untested states explicitly.
Preserve working functionality, approved brand/policy and unrelated edits. Do not
invent data, expand transactions, redesign good interfaces without evidence, or
treat this directive as independent authority for publication or real transactions.

For dashboard and managed-workforce work, follow the per-page index and state
coverage in the quality register and `frontend/tests/quality/dashboard-pages.txt`.
Keep source-only, launch-restricted, mocked and real acceptance distinct.
