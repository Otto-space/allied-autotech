# Administrator vehicle operations and actor attribution

The owner requested full Admin operations while retaining owner-only security,
financial policy and separate financial approvals. Vehicle create/edit, draft
listing creation and initial asking prices already allow current Admin/Super Admin
accounts with verified MFA across branches. Staff remain branch scoped. Admin enrollment no longer hides the operational
dashboard or blocks legacy operational routes. The session advertises scoped
workforce mode only for Staff; stored assignments are preserved. Owner-only role
checks and independent financial capabilities still run at their endpoints. Price
changes and document review additionally required an employee StaffProfile,
blocking administrator accounts that do not represent employees.

The fix records the authenticated User directly, with an optional legacy staff
link where one exists. It does not create employee records, change account roles,
grant financial permissions, bypass MFA, publish a vehicle, change a real asking
price or waive listing lifecycle/concurrency safeguards. Correctly grouped NGN
input is normalized exactly; malformed grouping remains an error.

## Forward migration and preservation review

`20261102090000_vehicle_operator_actor_history` adds nullable User foreign keys to
VehiclePriceHistory and VehicleDocument. Only VehiclePriceHistory.changedByStaffId
changes nullability. The following forward migration, `20261102091000_vehicle_document_user_reviewer`,
replaces the staff-only document-review check with the same verification/date/reason
rules accepting either a staff or User reviewer. Its replacement check is added and
validated before the old check is removed, preserving continuous protection.
Existing staff foreign keys, append-only price-history
triggers, amount/currency constraints and all historical rows remain untouched.
A check requires at least one real actor link on every price-history row.
There is no backfill, UPDATE, DELETE, data conversion, table/column removal or
inferred historical author. User deletion remains restricted by audit references.

The new API always stores its authenticated user ID, and the staff ID when present.
Existing staff history can remain user-null. Older API images can continue inserting
staff-attributed history and reviewing documents. They cannot provide the repaired
non-employee-admin operation after a rollback; preserve the forward schema and
restore service by rolling forward. Never reverse the migration or erase history.
The read-only runtime column probe returns no business rows. No old application
path projects the changed price-history staff field as a required public value.

The safe migrator's exact name/SHA-256 entry reviews the nullability expansion:
`f20ccbd5764db6c657fa73e73b7cfd7cb345f0c76e6370d6f59b95f9a7bb7e0c`.
Changed bytes or a renamed file must be reviewed again; no general bypass is added.

Required before publication: regenerate Prisma, replay all migrations into a new
isolated `_ci` database, run db:check and HTTP role/history tests, prove prior
staff-history preservation and append-only behavior, rehearse the forward change
on a separate populated production restore, verify off-device backup/recovery,
then take and verify a fresh target backup through the protected migration runner.
Apply only with npm run db:migrate on the verified production host/database.
Stop on history/schema drift or failed backup/rehearsal. Release matching packaged
images only after exact-source CI; predeploy remains read-only. Verify readiness,
all worker heartbeats and current roles without altering real vehicles for QA.

The first isolated replay and db:check passed. HTTP price/record operations passed
for Admin and Super Admin without employee profiles, but document review exposed
the older staff-only database constraint. That failure is retained; its correction
is a second forward migration, leaving the already replayed first migration intact.
The completed Home/workshop release is recorded separately.

## Published result and actual acceptance

Released source: `6f3cf203267618e7eb37660a18b7fae0954b39de`, signed and verified.
Backend `1597c138-919c-4470-b991-0add596837f9` is ACTIVE, 16/16 steps, with four
matching registry digests. Frontend `dpl_7HctXP7eYBDvCc9i7TnQsiG9hYgP` was held
until backend readiness and eight worker heartbeats passed, then promoted.
Both apex and www returned that deployment identity; www redirects to apex.
Only the four backend image digests changed. Settings, secrets, feature flags,
owner-only policies and the read-only predeploy command remained unchanged.

Exact-master checks passed: Frontend 41425787830, Backend safety 41425787658 and
repository secrets 41425787671. The preceding 1ff4a13c checks also passed; its
frontend run recorded 1,321 passing units and 12 existing fixture-gated skips.
The concurrent merge added only documents and acceptance tests. Explicit tree
comparisons established unchanged runtime and schema before reusing acceptance.
Other tasks' changes were retained without taking over their separate QA.

Verification actually performed:

- Generated Prisma; an empty isolated replay and db:check passed all 87 migrations.
  Three real isolated HTTP flows covered Admin/Super Admin without StaffProfile,
  stock create/edit, initial and changed asking prices, document review, exact
  User attribution, preserved staff history, append-only history, stale/concurrent
  versions, committed listings, denied roles/branches and revoked sessions.
- Forty focused backend and 16 frontend units passed. Forty-one wider workforce
  access/session/role-transition/directory cases passed. Eleven Customer Care and
  eleven learning HTTP cases passed on isolated data; test-only flags were explicit.
- A hosted 46-case synthetic browser run passed 41 cases. Its five failures were
  three obsolete review-row counts and two tests changing access before asynchronous
  review completed. Corrections retained cancel, confirm-once, exact values and
  denied-access assertions. Six corrected cases passed, followed by nine final
  candidate cases covering all five failures and four new price cases. This covers
  46 distinct scenarios across unchanged runtime, rather than claiming a single
  all-green 46-case run. The original failures remain in the private evidence.
- Four price cases passed again on the actual published route at 390/1440px for
  Admin/Super Admin with no employee profile. Correctly grouped NGN 55,000,000.00
  became exactly 5,500,000,000 kobo only after explicit confirmation; malformed
  grouping caused no write. Axe reported no violations. These use intercepted
  accounts and records, not actual production account/vehicle acceptance.
- Nine packaged checks passed for all four final images: non-root commands, TLS,
  secret exclusion, native media, imports, passwords and document fonts.

## Production preservation and recovery evidence

A fresh production archive was restored into a new, separate local `_ci` database.
The populated forward rehearsal preserved all 98 tables and every pre-existing
row hash through 85-to-87 applied migrations; its production source was read-only.
The final schema/migration machinery matched that rehearsal. A second fresh backup
was verified immediately before the protected production migration and separately
restored afterward. Historical rolled-back ledger rows were retained: 85 applied
migrations occupied 86 ledger rows before this release, and 87 occupy 88 afterward.
No migration was reset, edited after application, resolved or rerun.

Both reviewed migrations and db:check passed on the verified production host,
port 25060 and `allied_autotech_production`, with strict TLS and separate backup,
migration and runtime roles. The first final verification correctly failed when
the runtime role could not read `_prisma_migrations`; that permission was retained.
Read-only ledger verification used the migration role instead. All new columns and
four validated constraints were checked; runtime ownership, schema modification,
TRUNCATE, superuser and role-creation privileges remain absent. No grants changed.

A live-count comparison also stopped for investigation. Provider logs then proved
a successful `DELETE /favourites/:productId` at 10:06:19.276 UTC, before the guarded
migration attempt at 10:06:34.993 UTC. One favourite disappeared through that normal
request; an expired rate-limit bucket was cleaned up by the unchanged existing
worker. AuditLog increased by one and the ledger by two. Other table counts did
not decline. These legitimate live changes were preserved, not restored to make
counts match. The migration SQL contains no business INSERT, UPDATE or DELETE.
The populated isolated rehearsal, not a live count equality claim, proves unchanged
original rows through the DDL. Failed comparisons and their explanations are retained.

Managed external backups and available PITR were checked separately. A provider
PITR restore was not performed. The successful logical archive/restore rehearsals
are distinct evidence. Temporary own-IP access was removed after each inspection,
preserving concurrent firewall rules. Post-release read-only db:check, API readiness,
runtime least privilege and all eight worker heartbeats passed.

## Public regression, screenshots and remaining limits

Four unmocked public smoke cases passed on apex/www at 390/1440px: all three final
service prices, detail navigation, illustrative category labels, complete team
anchor, no page errors and no business mutations. Three live carousel regressions
passed: three real-time loops (56.8s), hover/manual pause and keyboard behavior
(54.0s), and controlled slow/failed images (26.8s). Earlier 17 Home and 26 About
scenarios and no-JavaScript/reduced-motion/visibility coverage remain in the
[Home report](../../frontend/docs/HOME_WORKSHOP_20261102.md).

Fresh safe public screenshots are in `%TEMP%/vehicle-operator-20261102/public-final`;
the Home report links both original before images and the latest after images.
Browser plugin was unavailable; existing Microsoft Edge/Playwright was used.
Physical-device Safari and a complete screen-reader journey remain untested.

The owner could not sign in for final actual-account authoring acceptance. No real
vehicle, asking price, account role or financial grant was changed as a QA example.
Refreshing the signed-in dashboard receives the repaired operational session mode.
Existing reserved/sold/archived price and concurrency safeguards still apply.
The three new public service descriptions still need the prepared editorial polish
in the Home report; prices, quantities, category IDs and unknown durations stay intact.

Bounded cleanup removed 32 local references to 24 superseded task images, without
force. Registry images, current/rollback images, warm caches, other tasks' resources,
all databases, archives and recovery evidence were retained. Measured C: free space
was 24.11 GiB before and 24.12 GiB afterward; local reference deletion is not a claim
of equivalent host-space reclamation or a machine-wide disk guarantee.
Six task-created provider-only browser-state/cookie files were removed after QA.
Owner credentials, CLI authentication and other tasks' browser state were retained.
The updated dashboard test list collects 288 tests in 93 files; collection alone
does not claim that entire list was executed in this cycle. Documentation formatting
and git diff checks passed. Release receipts are documentation-only follow-up work;
the deployed runtime and exact-source CI reference above remain `6f3cf203`.
