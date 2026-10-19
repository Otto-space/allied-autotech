# Workshop inspection source audit

Preparation after milestone 70; this is not an acceptance report. Actual frontend
route: `/admin/inspections`; API collection: `/staff/vehicle-inspections`. No
separate administrator inspection detail route currently exists. Preserve inline
progress management and existing completed-inspection condition-report linking.

Read the route, StaffInspections, InspectionStatusForm, staff inspection schemas,
vehicle-sales API schemas/repository/service, existing inspection browser tests
and shared query/pagination/profile/branch controls. The current listing repeats
large sections, stores filters/cursors only in memory and reads before its own
verified profile. It omits lifecycle/reference/version facts and typed condition
findings. It does not distinguish refresh failures in its disabled condition.

Use persistent supported status/branch filters and cursor navigation, compact
named request cards/table, explicit full preference/schedule/assignment facts,
customer notes and lifecycle dates, and accessible inline progress disclosures.
Retain all supported transitions and existing roles/branch scope. Reuse active
branch and Staff pickers, forms, mutation dialog and real API clients. Do not add
unsupported search/date filters, totals or a fabricated inspection-detail route.

Inspect exact current backend assignment and transition behavior before guard
implementation. Validate scope, dates, enums, identity and duplicate rows. Current
profile/Staff assignment must gate reads; errors disable mutations and denial
clears private records. Review needs fresh access/current inspection facts,
expectedVersion and complete permitted submitted values. Preserve drafts on
concurrent changes, block uncertain replay across reload and explicitly distinguish
current-read reconciliation from original-request outcome proof. No individual
inspection GET exists; use existing collection paging if needed rather than
inventing a read contract. Backend atomic version checks remain necessary.

Generate and inspect fresh desktop/mobile concepts, save a concrete specification,
then edit UI. Run focused unit, existing/new browser and isolated API scenarios;
verify real scheduling/status writes and role boundaries. Reuse unchanged build,
database replay and privilege setup. No schema change is currently assumed.
