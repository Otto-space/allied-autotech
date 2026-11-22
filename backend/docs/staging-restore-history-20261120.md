# Staging restore: historical migration-byte recovery (20 November 2026)

This note applies **only** to the separately isolated DigitalOcean database
`allied_autotech_staging` on cluster
`allied-autotech-restore-acceptance-20261120`. It is not a production schema
validation, backup receipt, or release authorization.

## Verified evidence

- The read-only database ledger contains **59 applied**, **0 unfinished**, and
  **0 rolled-back** migrations. The source checkout has **132** directories,
  leaving **73** forward migrations. The latest applied migration is
  `20261017153000_promotion_zero_value_configuration`.
- A separately approved, credential-free DigitalOcean App Platform job
  (`allied-image-hash-20261120`, app ID
  `414a651c-cc6f-4cd2-ac3c-e3ff28d0f091`) inspected the original migration
  image. Its exact 7,343-byte managed-media SQL has SHA256
  `eb71bac3433a906ea50fd8f6c36c921d5deda32e7fbb79c45b0`. The immutable
  source digest is
  `sha256:aaa8a799d2c779ee9a1767fb8b2f464dbb417d935e88539c00a6e51f4f8f2279`.
- That historical SQL differs from today's Git LF text by only a **terminal
  CRLF**; six preceding owner-policy migration SQL files were entirely CRLF.
  Reconstructing those exact seven historical byte profiles alongside the
  other 52 LF files produces the journal fingerprint
  **`27b094f565badb0bed039bed3d9d30ff`**.
- The conservative SQL danger scanner rejects none of the 73 pending files.
  All six already reviewed backfill exceptions match their fixed SHA256 values.
  This is a syntax/safety preflight, **not** a data-preservation rehearsal.

## Disposable preparation (no database connection)

From the repository root:

```sh
node backend/scripts/verify-restore-migration-history.mjs
node backend/scripts/prepare-isolated-restore-migrator.mjs --prepare
```

The second command creates a fresh private directory under the environment's
temporary location, copies the guarded migration runtime and all 132 SQL
files, and reconstructs only the first 59 applied SQL files in that copy. It
verifies the 59-file journal fingerprint and all 73 unmodified pending SQL
checksums. It never edits the repository or database. Dependencies are linked
when run inside the separately built migration image; no Docker installation
is needed on the owner's PC.

**Do not run the resulting migrator against production.** A separate fresh
off-device exact-target backup with a verified, under-one-hour receipt, an
independent populated restore rehearsal, identity/privilege checks for the
schema-owner migrator, SQL/data-preservation review, and explicit
`DB_MIGRATION_TARGET` are still required. Only the existing protected
`npm run db:migrate`/`migrate-safely.ts` path is authorized for an eventual
guarded forward migration; direct Prisma deploy/reset/resolve is forbidden.

This receipt does not prove the current production database's 112-migration
baseline. The historical 59-migration staging snapshot must not be mistaken
for a successful production-backup restore. Keep the separate restore cluster
and source records intact; do not overwrite or delete them without owner
approval. No database, production, customer, or payment changes were made by
this investigation.
