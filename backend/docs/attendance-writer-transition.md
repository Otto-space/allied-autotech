# Attendance writer transition and recovery

This is a held release sequence, not evidence of production publication.

The attendance migration adds append-only verification and a deferred constraint
requiring evidence for a transition to `NO_SHOW`. A successful scalar startup
probe does not prove an older API can perform that transition. Its raw status
writer must be rejected before the constraint is introduced.

1. Finish the compatibility patch's required checks for the exact master source.
   Package and verify that API and its runtime using the existing release workflow.
   Verify current deployment and recovery identities, encrypted off-device backup,
   retention/PITR evidence, a fresh backup and an isolated populated restore before
   publication. The compatibility application remains at migration level 97 and
   refuses raw missed-status changes for all roles. It does not provide attendance
   authoring. Keep this transitional limitation explicit in staff guidance.
2. Finish and integrate the full attendance feature separately. Preserve the
   verified-absence route's private transition allowance; do not merge the
   compatibility patch as an unconditional rejection of that verified route.
   Preserve the complete attendance notification and append-only audit transaction.
   Reconcile article versions above the published compatibility versions.
3. Require exact-master checks, real dashboard fixture acceptance and matching
   packaged Linux tests. Rehearse migration 98 against a fresh isolated restore,
   preserving original columns, row counts/hashes and prior migration history.
   Recheck target, least privilege, backups and recoverability before guarded
   production migration. No booking or payment flag is enabled by this work.
4. Retain a reviewed recovery spec with per-component source/digest provenance.
   After migration 98, keep the verified **98-aware migration component**, even if
   restoring the compatible older API and worker runtimes. Do not run an old
   97-only migrator against the newer ledger, rewrite history or revert SQL.
   The normal immutable release-manifest validator remains unchanged; a mixed
   recovery composition requires its own explicit, immutable validation and tests.
5. Verify the actual runtime startup probe and unsupported writer behavior against
   the new schema, not merely image startup. Keep every current and rollback image
   and the exact restore/recovery receipts. An emergency compatibility recovery
   temporarily lacks new attendance authoring; preserve existing evidence and
   present read/loading/error states honestly. It must not invent successful saves.

Local evidence: the native compatibility rehearsal uses a newly created isolated
`_ci` database replayed from immutable, checkout-filtered migration-98 source.
The genuine previous generated model set passes the API/worker scalar probe.
Authenticated assigned Staff, Admin and Super Admin direct missed-status writes
return 409 and leave the booking unchanged. This is isolated native evidence,
not packaged/provider/live-role acceptance. The older worktree-byte test database
was retained after a checksum mismatch; its ledger was not edited or bypassed.

Approved operator network access remains scoped to the current computer for the
remaining bounded backup, restore and verified-release work. Add a rule only when
needed; record and remove only its UUID, then freshly verify removal. Stop on
target, source, privilege, migration, backup, recovery or concurrent-release drift.

The compatibility UI removes the unavailable raw missed-status option and labels the temporary limitation. When integrating the full feature, remove that temporary sentence and compatibility-only browser case/project; retain the raw-option removal and replace coverage with the complete verified-attendance workflow.
