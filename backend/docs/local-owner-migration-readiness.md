# Local owner migration implementation and rehearsal gate

Status: implementation in progress; no live database acceptance or rehearsal yet.
Persistent development migrations remain unapproved. Do not infer readiness from
mocked tests or a successful Node identity probe.

## Current evidence

- Branch `feat/mobile-scaffold`; the three approved disk-preflight edits and `.idea/`
  are retained. No committed migrations were edited.
- Fresh inline disk preflight passed with 36.71 GiB free and a 25 GiB requirement.
- Node 26 can run the focused dependency-free test without installing packages:
  `node --test backend/scripts/lib/local-owner-safety.test.mjs`.
- Backend dependencies are absent. Cached Prisma 7.10.0 matches the lock, but cached
  tsx 4.23.1 differs from locked 4.23.13; no complete compatible backend tree was found.
- The attachment refers to consolidated pgAdmin results, but contains no results.
  No approved private credential mechanism has been provided. No database connection,
  membership grant, role creation, database creation, default or migration ran.

## Implementation boundary

`LOCAL_DB_OWNER_MODE=true` is opt-in tooling configuration. It requires explicit
development/test environment, `127.0.0.1:5432`, `aat_dev_migrator`, and either
`allied_autotech_dev` or a rehearsal name matching
`aat_dev_(rehearsal|guarded|restore)_[a-f0-9]{8,32}_(test|ci)`.
Test mode cannot target development. PostgreSQL service/session overrides are rejected.
Ordinary hosted identities retain their existing path.

History/replay inspection verifies authenticated and effective identities separately,
database ownership, restricted attributes, exact membership options and database-scoped
owner default before interpreting metadata. Initial replay checks catalogs for objects
that a permission-filtered table count can miss. The existing history/checksum,
destructive SQL, backup receipt and post-check mechanisms remain in place.

Prisma configuration independently probes the same local target. This is still a
Node probe, not evidence of every Prisma engine session. Rehearsal must independently
verify Prisma-created ledger/table/sequence/function ownership. The local post-history
guard checks relation/routine ownership, unreviewed SECURITY DEFINER routines and
effective application access to the ledger. Extension-owned objects are distinguished.

Local backup tooling requires separate `DB_BACKUP_USER`/`DB_BACKUP_PASSWORD` credentials.
The backup role must remain its own effective identity with no memberships. The local
completeness gate rejects RLS, foreign tables, large objects, missing SELECT, ownership
and database/schema creation or TEMPORARY authority. It does not enable row_security
or BYPASSRLS. These conservative failures require review, not automatic privilege repair.
Archive/hash/target/receipt checks remain mandatory; restore testing is still required.

## Pending live metadata and owner authority review

Run `backend/ops/postgres/local-readiness.sql` in the existing local administrator
pgAdmin session. Inspect all owner memberships, owned databases and effective privileges
before granting cluster-wide membership. Do not change unrelated database ACLs.
Inspect existing PUBLIC grants, policies, sequences, routines and defaults. Actual
authentication attempts are required for all identities and unrelated database denial.

Only after that review, apply the authorized membership and a default to a newly
created isolated rehearsal database first:

```sql
GRANT aat_dev_owner TO aat_dev_migrator
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
-- Example name only; verify absent before creating the explicitly selected target.
ALTER ROLE aat_dev_migrator IN DATABASE aat_dev_rehearsal_a1234567_test
  SET role = 'aat_dev_owner';
```

Do not apply the corresponding development default until isolated evidence passes.
Verify any existing backup identity before creating the approved dedicated backup role.
No owner membership, superuser or BYPASSRLS is authorized for backup or runtime.

## Runtime grant review

No runtime grant SQL is applied or automatically generated. Blanket DML on all tables
is not a least-privilege matrix. Source inspection gives these concrete starting points:

| Object | Evidence | Proposed maximum pending rehearsal |
| --- | --- | --- |
| `_prisma_migrations` | Tooling history only | No application rights, including PUBLIC-derived rights |
| `AuditLog` | `audit.repository.ts` reads; `audit.service.ts` inserts | SELECT/INSERT; no UPDATE/DELETE |
| `PaymentLedgerEntry` | Payment/refund services use upsert with empty update | Review emitted SQL before deciding whether SELECT/INSERT suffices; no automatic UPDATE grant |
| `VehiclePriceHistory` | `vehicles.repository.ts` inserts | Append-only candidate; relation reads need review |
| `ProductCompatibilityHistory` | Catalogue/fitment services read and insert | SELECT/INSERT; no UPDATE/DELETE |
| Other application tables | Direct/nested delegate calls, raw SQL and cascades | Per-operation review still required; no blanket grant |
| Sequences | Actual insert defaults | USAGE only where required; no SETVAL or ownership |
| Functions | Extension and trigger dependencies | No blanket EXECUTE grant; review PUBLIC and SECURITY DEFINER |

No RLS enablement/policy or SECURITY DEFINER declarations were found in the migration
source scan; live metadata remains authoritative. Default application table grants must
not expose a future ledger. Audit and other immutable financial/history objects require
negative UPDATE/DELETE tests, not only positive DML tests. Runtime role separation does
not replace application authorization, triggers or business-policy checks.

## Dependency and execution gate

Installation requires separate approval: `npm.cmd ci --prefix backend`.
Use the existing lock unchanged; budget up to 5 GiB additional space for dependencies,
cache and Prisma artifacts, and rerun the 25 GiB preflight immediately beforehand.
Do not silently reuse incompatible cached versions or install to resolve missing tools.

After approved installation and isolated provisioning, supply passwords privately in
process environment, never chat, files, logs or command arguments. Migration variables:
`DB_HOST=127.0.0.1`, `DB_PORT=5432`, `DB_USER=aat_dev_migrator`,
`LOCAL_DB_OWNER_MODE=true`, the exact isolated DB_NAME and separate backup variables.

From backend, replay a new empty isolated target with `NODE_ENV=test` and
`CONFIRM_EMPTY_MIGRATION_DATABASE=true`: `npm run test:migrations`, then
`npm run db:check`. Every command must pass before continuing. Use another new
isolated `guarded` target with the confirmation flag unset for `npm run db:migrate`,
so the backup/deploy guard is exercised rather than its replay exception.

Restore the verified archive into a separate newly created `restore` target, verify
schema/history, object ownership, row counts and synthetic fixture integrity. Do not
restore over development. Keep provider/worker activity disabled. Verify actual runtime
authentication, restricted grants and representative local API reads/writes using only
synthetic fixtures. No readiness claim is permitted until those stages pass.

The future persistent command is `npm run db:migrate` from backend with
`NODE_ENV=development`, `DB_NAME=allied_autotech_dev`, the verified local migration
identity/default, separate backup credentials and a fresh disk preflight. Do not run it
until the consolidated rehearsal report receives the owner's final authorization.

## Recovery and retained state

Stop on any drift, ownership mismatch, failed backup, unexpected RLS or failed migration.
Preserve archives/receipts and partial state; fix forward. Do not edit migration history,
reset a database or restore over development. Reversing a login default/membership does
not reverse migrated schema. No test databases, backups or shared caches have been
deleted. Retain uncertain resources and review their ownership before any future cleanup.
