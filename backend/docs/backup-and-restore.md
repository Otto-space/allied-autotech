# Backup and restore

Use the [database safety workflow](database-safety.md) and mandatory [repository rules](../../AGENTS.md).

`npm run db:backup` creates a PostgreSQL custom-format archive outside the repository,
verifies its database name and records a SHA-256 receipt. `db:migrate` requires this
evidence for pending migrations. A readable archive index and matching hash prove
archive identity/integrity, not a successful restore.

Before shared/production changes, rehearse restoration into a newly created, separate
database. Never restore over the source/application database for a test. Verify critical
row counts and relationships, financial/audit history, migrations, constraints, roles,
and application flows. Record the backup identity, rehearsal result and recovery time
privately without exporting customer data or credentials into repository artifacts.

Configure automatic encrypted off-device backups and appropriate retention through
your hosting/storage provider. Enable managed point-in-time recovery where supported.
Keep restore credentials separate from runtime credentials and retain the old release.
Define recovery point/time objectives before going live. This repository has not
configured provider backups, encryption, retention schedules or point-in-time recovery.

If recovery is needed, preserve the affected database and logs, identify the last
verified recovery point, test recovery separately and obtain explicit authorization
before overwriting a live database. Prefer reviewed forward fixes when data is intact.
