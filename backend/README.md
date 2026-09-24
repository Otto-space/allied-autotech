# Allied AutoTech backend

Standalone Node 24.13.0 / Express 5 / Prisma PostgreSQL package. Run npm commands from this directory; the repository root is not an npm workspace.

Current owner-policy delivery (24 September 2026):

- [Implementation and policy matrix](docs/owner-implementation-matrix.md)
- [Verification and readiness evidence](docs/owner-completion-evidence.md)
- [Private staging deployment runbook](docs/owner-staging-runbook.md)
- [Owner questions still pending](docs/owner-decision-checklist.md)
- [API examples](docs/owner-api-examples.http), [OpenAPI](docs/api/allied-autotech.openapi.json), [endpoint handbook](docs/api/endpoint-handbook.md)

These supersede older phase descriptions where owner policies differ. No live activation is authorized by this handoff.

```sh
npm ci
npm run prisma:generate
npm run build
npm run typecheck
npm run check:scripts
npm run check:openapi
npm run check:routes
npm run lint
npm run format:check
```

Use `.env.staging.example` and `.env.production.example` as placeholder inventories; actual credentials stay outside git. Follow the runbook for PRE_DEPLOY migrations and per-process secrets. Never reset a populated database.

Before starting the local API or workers after a backend update, confirm that `.env` points to your intended development database and apply pending migrations:

```sh
npm run db:migrate
npm run prisma:generate
npm run worker:identity
```

Run the API (`npm run dev`) and general worker (`npm run worker:general`) in separate terminals. Prisma client generation does not update the database. `P2021` means a required table is missing; `P2022` means a required column is missing. Check the configured database and run `npm run db:migrate` from `backend`; back up populated databases before upgrading. The identity worker retries automatically after migrations finish. Do not use `migrate reset`, `db push`, or the isolated test migration replay to repair an existing application database.

Database tests require `RUN_DATABASE_TESTS=true` and `TEST_DB_NAME` pointing to a newly created, migrated isolated `_test` database. The separate owner-provisioning suite additionally requires `RUN_OWNER_PROVISIONING_TESTS=true` and its own empty migrated database. Exact executed commands/results are in the evidence document.

The local TLS handshake test requires OpenSSL (Git for Windows includes it). It generates disposable local certificates, verifies hostname/certificate rejection and never connects to a real payment or cloud provider.

The workshop owner-access regression suite requires a separate migrated `_test` database with no owner (or its previously created owner without a staff profile). Set `RUN_DATABASE_TESTS=true`, `RUN_WORKSHOP_ACCESS_TESTS=true` and `TEST_DB_NAME` to that database, then run `npx vitest run tests/integration/workshop-owner-access.test.ts`. It verifies administrator access without a staff profile alongside staff branch restrictions, MFA, CSRF and audit attribution.
