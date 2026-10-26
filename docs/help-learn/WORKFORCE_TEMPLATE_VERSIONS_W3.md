# Revision 4 W3: pinned responsibility definitions

Predecessors: W1 `72a8aeaf`, W2 `1cb71297`. This checkpoint was initially local only. The owner subsequently authorised deployment of the committed batch; see backend/docs/workforce-versions-production-20261026.md for actual release and recovery evidence.

## Model and authority

Forward migration `20261026180000_workforce_template_versions` adds a positive
`WorkforceAssignment.templateVersion` and
`WorkforceAccess.delegationPolicyVersion`, both defaulting to **1**. It preserves
all existing users, positions, grants, scopes, dates, reasons and history. It does
not enroll a legacy account, infer a job from a title or grant any new responsibility.
New exact-file LF attributes preserve the SQL checksum across Windows/Linux; no
applied migration or older newline rule was changed. Prisma Client was regenerated. The reviewed SQL also passes the existing
non-destructive migration guard without adding an exception or bypass.

The controlled version-1 catalogue is deeply frozen and protected by a reviewed
mapping checksum test. Existing implicit fitment authorship/review authority is
now represented by explicit `FITMENT_AUTHOR` / `FITMENT_REVIEW` capabilities with
the same role-template/branch and independent-review restrictions as before.
Changing a label/position still grants nothing. An unsupported template version or
scope grants no operational access; an unknown policy version or ambiguous grant
name cannot become delegation authority by falling back to the current catalogue.

New assignments require the current reviewed `expectedTemplateVersion`; owner
delegation changes require the current reviewed `expectedPolicyVersion`, alongside
the existing account/workforce version, password, MFA, reason and target checks.
The default request version stays **1** for old version-1 clients; a future expanded
catalogue must reject an older cached review rather than silently upgrade it.
Updated clients opt in with `receiptVersion: 2` to receive version metadata.
Legacy enrollment, assignment, revocation and delegation receipts retain their
published strict shape; the projection explicitly excludes unknown database fields.
This affects acknowledgements only, never authorisation or persistence.
Existing supported assignments resolve their pinned definition, not whatever the
latest template later contains. Delegation must be reviewed before assigning an
expanded version. Owner review/revocation remains available when a delegation
policy is unsupported; revocation does not silently repair or reinterpret it.

Current effective access, branch helpers, booking/enquiry scope, fitment, assignee
options, assignment validation and support-notification recipients consume these
definitions. Invalid/unknown versions are not treated as eligible assignees or
notification recipients. Legacy non-enrolled baseline policies remain unchanged.
The management response supplies per-assignment definitions and catalogue version;
known-template assignments with unsupported versions remain visible for an authorised owner as inactive, with
an explicit review notice. Receipts cannot change the pinned version on revocation.
The frontend's fitment navigation and direct page guard now use the same server
capability projection, rather than a job-title/template-name shortcut.

## Reproduced target-scope defect

The new negative HTTP case returned **200** when a delegated Admin posted an
assignment to a copied Staff ID outside the Admin's permitted account branch,
although opening that account's detail returned **403**. The shared mutation
authorizer now enforces the same target-account branch boundary for assignments
and revocations, in addition to template and assignment-branch delegation. The
final negative case expects 403 and verifies the target revision stays unchanged.
Protected-owner, no-self-management and established promotion restrictions remain.
Existing historical cross-branch grants were not automatically revoked or moved;
their business legitimacy requires an authorised review, not an inferred cleanup.

## Actual verification

- Newly created exact-loopback isolated database:
  `127.0.0.1:63888 / allied_workforce_r4_versions_20261026_bbaf8370a5c0_ci`.
  Actual host, port and protected native data directory verified before creation.
  Empty replay of **72 migrations**, Prisma schema comparison and `db:check` passed.
  This is separate from W1/W2's original 71-migration database; neither was reset.
- The exact forward SQL also ran against two populated **structurally reduced
  fixture tables** in a new private schema inside that CI database. Both complete
  pre-existing rows (including existing revision/delegation/reason) were equal
  afterward, new defaults were 1, and two invalid zero-version writes were rejected.
  SQL SHA-256: `cc7b6c1a6a8f0d781d75b203bce1336345626a2727337046a8785c9ad6529ac0`.
  This is additional DDL-preservation evidence, not a full populated production
  migration/restore rehearsal. Fixture schema/data are retained, not dropped.
- Restricted runtime checks query PostgreSQL itself: no superuser, role/database
  creation, database/table ownership, schema creation, TRUNCATE or migration-ledger
  writes. The migration identity remains separate from the DML-only test runtime.
- Integration acceptance covers workforce/directory/team/role transitions and
  existing reviewed parts fitment, plus defaults, unknown versions/policies,
  ambiguous historical delegation names, copied target IDs, immutable receipts,
  assignee eligibility, notification recipients and positive database constraints.
  Final integration run: **57 tests passed in seven files**, including actual HTTP
  validation by all four strict legacy receipt parsers. New opt-in assignment
  metadata is checked separately; old callers still persist pinned version 1.
- Five catalogue/receipt unit cases passed. Final full frontend suite: **1,057 tests passed in 162 files** after the receipt
  compatibility change. The optimized build, standalone postbuild and lint passed. Three fitment DOM
  cases verify that navigation and the direct component guard agree. Component
  fixtures are not real-role or full fitment-page browser acceptance.
- Types/lint/script checks, 365-path OpenAPI, 425-operation route parity and
  generated frontend contracts were checked. Source inventory remains 106 routes /
  337 interaction and boundary files; the coverage completion gate remains open.
- W3 browser checks have not run. The compiled preview startup was rejected by
  automatic approval review with "blocked by policy" during W1/W2; no alternative
  startup was attempted. Earlier W1 development-preview screenshots/interactions
  do not certify W3's version notices, refreshed editor or guard changes. Exact
  lockfile CI, hosted real roles, physical devices and screen-reader acceptance
  remain unverified. Installed Next is 16.3.8 versus lockfile 16.4.3.

An initial API export hit a transient Windows file-open error. Dependent checks
were stopped, the unchanged generator reran successfully, then frontend API types
and final checks were run in dependency order. No production state was affected.

Private, non-secret test receipts/logs are in
`%TEMP%/allied-workforce-r4-versions-20261026-db/`. No real invitation, message,
provider AI request, stock publication or application/shared database write.

## Release dependency and remaining goal

Before a separately authorised rollout, apply the reviewed migration through
`npm run db:migrate` with the mandatory exact-target, backup/PITR and restore gates,
then verify `db:check` and deploy compatible runtime/clients. Do not use startup to
migrate. Do not roll back blindly to a 71-migration checker or downgrade/drop these
columns. Prepare a forward-compatible rollback source that retains migration 72
and understands the pinned fields. No release, backup or restore-over-live was
performed by this batch.

The full foundation still requires the complete effective-access provenance and
added/removed/retained preview, canonical whole-dashboard navigation/action registry,
active-page/draft/subscription transition acceptance and role/responsibility coverage.
Graceful management display of completely unrecognised historical template IDs or
scope strings also needs verification; it is not established by the known-template,
unknown-version cases in this batch. They are never mapped to a broader grant.
Actual conversational AI, all-route reviewed learning, persisted reviewed human
handoff, gated chat staffing/transport and at least 100 reviewed AI evaluations
remain required. Current deterministic Allie is not completion of the AI requirement.

Postflight: C: measured 28.12 GiB free above the 20 GiB reserve. No Docker
resources were created or pruned; current/rollback/other-task images, containers,
volumes and useful caches remain. Current build and isolated CI verification data
are useful for the next foundation batch. No duplicate dependencies, worktree or
editor profile. Shared native PostgreSQL remains; owned app preview is stopped.
