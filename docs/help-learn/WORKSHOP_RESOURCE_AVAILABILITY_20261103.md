# D06 resource-aware offer discovery — 3 November 2026

Service-request advances to v25. Its public gate, guide targets and practice
permissions remain unchanged. The existing owner resource-plan guide stays draft;
no guide or feature flag is activated by this source change.

Discovery requires the currently effective approved branch calendar and resource
plan, an explicitly assessed service, current actual job duty and qualification,
working periods and recorded absences. It uses the same maximum matcher and
occupancy predicates as atomic confirmation: distinct working physical units,
preparation/job/cleanup, actual completion cleanup, overdue unfinished work and
unassessed overlapping legacy work. No policy or allocation history is rewritten.
Explicitly assessed no-equipment work remains independent of unrelated equipment;
its own technician and calendar checks still apply.

The calendar, plan, duty eligibility, candidate reads and public projections share
one repeatable-read snapshot. Resource filtering happens before output pagination;
internal scanning continues beyond an exhausted candidate batch. Only existing
public offer fields and visible offer cursors are returned; equipment, staff,
allocation and other customers' booking identities remain private. Existing
private/no-store API headers remain in force.

Submitting a selected offer rechecks actual resource availability without reserving
physical units or creating a payment. A changed/conflicting selection is rejected
before a booking is created. Confirmation still performs its separately authorised
atomic allocation. Missing approved resources do not forbid an unconfirmed
preferred-time request. Existing reschedule originals and their allocations remain
held until the reviewed atomic switch.

Final native resource lifecycle/discovery run passes 25/25 after all 97 migrations,
Prisma diff and db:check on a fresh exact-owned tmpfs test target with restricted
runtime credentials. The preceding full run passed the other 100 native cases;
its three remaining failures were corrected fixtures, not waived assertions:
required legacy confirmation timestamp and the preserved 7–14 day booking window.
The final focused run includes those three cases. These counts cover 125 distinct
cases across runs, not 147. All owned test containers were removed after evidence.
51 resource/learning/role units, source/scripts compilers, full backend lint,
OpenAPI validation/route coverage and secret guard pass. Logs are under %TEMP%:
aat-resource-aware-offers-focused-native.log and the retained earlier full-run logs.

Failed attempts are retained: a fixture name collision, the SQL expression cast
precedence error reproduced with an isolated read-only query and corrected with
parentheses, and an availability check initially preceding the workforce permission
boundary. The original 403 and rollback assertions are preserved and pass.
Exact-source merged hosted checks and production publication are still pending.
No new schema, real workshop data, grant, provider configuration or production
publication. Actual owner resource configuration and real-role acceptance remain
separate; D06 and the complete D01-D17 goal are not marked complete.
