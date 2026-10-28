# Workforce versioning production release ? 26 October 2026

Runtime **c4e0005d7da48d0ab7cfd0789835b4b955be3d55** is live. The owner explicitly
requested deployment of committed pending changes. Release branch:
release/workforce-versions-20261026, reusing allied-home-restoration-20261025.

## Source and scope

Pending implementation **432308e0** pins responsibility/delegation definitions,
closes the reproduced delegated-admin copied-target branch bypass, aligns fitment,
assignee and support-recipient eligibility, and preserves strict legacy mutation
receipts. Updated clients explicitly request version metadata.

Production was rechecked rather than inferred from branch tips: frontend 8c11c3a0
already contained W1/W2 and the campaign artwork; backend 2033b159 additionally
contained the payment-source concurrency fix. Both are preserved. Merges 5f632b93
and c4e0005d reconcile those sources and release evidence; conflicts were limited
to append records, and both records were retained. Payment runtime and campaign
files were compared byte-for-byte against the deployed predecessors. Other
worktrees, including uncommitted colour work and the main tracker, were preserved.

## Actual release identities

- Backend **707a200f-17c3-4947-a0bd-21b39496cf6a**, ACTIVE, no pending rollout.
- Frontend **dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln**, READY. Management API reads
  verified both alliedautotech.com and www.alliedautotech.com resolve to it and
  its source SHA matches the frozen runtime.
- All four immutable backend digests match the reviewed manifest. Only those
  digests changed in the existing app spec; capacities, secrets, launch mode,
  learning flags, permissions and disabled commerce/provider settings were retained.
- Backend-first promotion: production migration, backend read-only PRE_DEPLOY gate,
  ACTIVE/readiness and worker checks, then frontend promotion with domains held.

## Migration and preservation

Forward migration **20261026180000_workforce_template_versions** is migration 72.
SHA256: cc7b6c1a6a8f0d781d75b203bce1336345626a2727337046a8785c9ad6529ac0.
It adds positive version fields defaulting to 1; no existing account, responsibility,
position, scope, grant or application history is removed or inferred.

Actual production host/port/database/environment and separate migration, backup
and runtime identities were verified with strict TLS. A fresh dedicated-role
backup was verified before the supported **npm run db:migrate** command applied
one reviewed migration. The guarded runner and subsequent db:check passed.
A separate read-only audit checked all 72 applied checksums, both validated positive
constraints and zero assignments/delegations with unexpected versions. Runtime
privileges remain restricted, including no migration-ledger SELECT, ownership,
DDL or TRUNCATE; no grants changed. Original app-only firewall rules were restored
and independently rechecked after diagnostic windows.

A fresh production archive was actually restored into the newly created isolated
allied_workforce_restore_20261026_f2f522ac4fb4_ci database on exact loopback
127.0.0.1:63888. All 90 restored tables and original history were verified; the
forward migration and db:check passed. Hashes of original business rows, excluding
only the newly added version fields, remained equal. This is a populated logical
restore/migration rehearsal, not a new physical managed PITR exercise.

Eight current managed backups were observed, newest 26 October 05:22:11 UTC.
Managed backup/retention/PITR and encryption evidence was reviewed against the
[provider recovery documentation](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/)
and [security/features documentation](https://docs.digitalocean.com/products/databases/postgresql/details/features/).
Local archives supplement the managed off-device service; they are not its replacement.
No new paid resource or cloud restore cluster was created.

## Verification and qualifications

All exact-runtime CI workflows passed: backend **40388912593**, frontend
**40388912600**, secret guard **40388912718**. Locked CI/hosted builds use Next
16.4.3; installed local Next remains 16.3.8. Existing W3 local evidence includes
1,057 frontend unit cases and optimized build/postbuild. The merged release passed
**123 integration tests in 16 files** on a newly created isolated 72-migration CI
DB under a restricted runtime, plus five focused units and **41 release-spec /
packaged-image checks**.

**43 distinct hosted-candidate browser cases accepted** with repository Playwright
and installed Edge because the Browser plugin is unavailable. Coverage includes
320/390/430/768/1024/1440 widths, directory/search/pagination, scoped Axe, keyboard,
review/revisions, lost/mismatched mutation outcomes, scope loss, assignment and
revocation, delegation and version-2 receipts. Unsupported definition notices and
keyboard details were additionally verified at 390/1440, and screenshots inspected:

- %TEMP%/allied-workforce-release-browser/pinned-definition-390.png
- %TEMP%/allied-workforce-release-browser/pinned-definition-1440.png

These use isolated API/page fixtures; unmatched API traffic is blocked. No real
staff grant, customer message, upload, inventory seed, payment or operational form
submission was used. Hosted actual-role mutations, physical devices and full
screen-reader acceptance remain unverified. Full-page screenshots taken after
scrolling can place fixed chrome mid-capture; they do not prove viewport placement.

Initial expanded integration tests under a two-connection runner passed 116/123;
seven lock-observation cases required spare connections. The unchanged tests all
passed with an eight-connection local test runner. Initial browser run passed 39/41.
Targeted checks accepted the two remaining journeys after excluding only known
framework font-preload warnings and awaiting each completed staff-filter navigation.
**Existing rapid overlapping staff-directory filter changes can lose earlier
filters.** That unchanged pre-existing behaviour remains a separate issue; the
settled-navigation check does not certify rapid changes. Runtime errors remain asserted.

The operator harness also required corrections: UTF-16 log decoding; migration
history must use the migrator rather than the intentionally restricted runtime;
and a receipt-variable collision. No migration was rerun, database permission
broadened or live repair attempted. The attempted live all-table count comparison
was not completed because runtime correctly cannot read the migration ledger;
row preservation is established by reviewed additive SQL and the separate populated
restore rehearsal. A post-release connection timeout was followed by a successful
read-only retry with a 30-second connection allowance. Temporary firewall access
was restored after every attempt.

Final hosted reads: live/ready 200, anonymous workforce-directory and own-access
reads 401. Production db:check, runtime restrictions and three fresh error-free
identity/browser-push/notification-delivery heartbeats passed after activation.
The final domain/backend/firewall receipt is workforce-release-production-verified.json
inside the ignored protected operator directory.

## Recovery, continuity and retention

Retain the preceding backend 3cb61958-e460-494b-ae29-1ce826ac22b9 and frontend
 dpl_7mLXWniyi5uZoMPivAPtaWQPeK56 for history and investigation. A frontend rollback
can restore that frontend while keeping the new backend and migration 72. Prepared
composition **6b6f8ad0ecfffee80f16d9538a4a2eba75423ff6**, branch
rollback/workforce-versions-frontend-20261026, has the exact new backend tree and
exact preceding frontend tree. Do not blindly redeploy a 71-migration checker,
drop version columns or restore over production. Backend incidents require a
reviewed forward-compatible fix and fresh release gates.

Current, rollback, other-task, database and backup resources were retained. Docker
images 75/13.01 GB -> 79/13.05 GB; useful cache 9.17 -> 9.258 GB; all 13 containers
and 14 volumes remain. No speculative pruning, duplicate install, worktree, editor
profile or image archive. One task-created root Vitest result/cache and empty parent
directories were removed. The temporary provider browser-cookie file was removed
at completion. C: postflight measured 27.71 GiB free, above the 20 GiB reserve;
this is a point-in-time preflight, not an OS quota or a physical-reclaim claim.

This deploys the committed W3 batch only. Complete effective-access provenance,
all-route learning coverage, active-session/subscription acceptance, actual
conversational AI, reviewed persisted handoff, gated live chat and at least 100
reviewed AI evaluations remain required by the active Revision 4 goal. They are
not completed or enabled by this deployment. Future uncommitted work is not
covered by this publication instruction. Broader site-completion Item 6 stays open.
