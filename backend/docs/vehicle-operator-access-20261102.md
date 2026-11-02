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
Implementation and verification are in progress. This is not migration or release
evidence. The completed Home/workshop release is recorded separately.
