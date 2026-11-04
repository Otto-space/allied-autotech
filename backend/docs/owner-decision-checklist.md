### 4 November 2026: D06/D07 recorded-work capacity follow-up

Base is exact-master 8dd5e22e, retaining the newer shared UI, overview, financial and
resource changes. The follow-up also merges master 1b4e5d15 customer-attention and
collection-readiness changes without modifying their application or API files. That master passes all three required hosted checks. Its release
remains held: the cached-build assumption failed and the 2 GiB allowance requires
22 GiB free; last observed space is about 21.8 GiB. The owned build was stopped,
old receipts archived without deletion, and production was not changed by this batch.

The next regression audit covers actual early/late starts and overdue work whose
legacy status still says Confirmed. Candidate resource/technician availability must
respect recorded work and explicit completion/cleanup, preserve allocation history
and leave independent work available. First local attempt stopped at the isolated
target proof because a new task namespace was not supported; no fixtures ran and
the owned tmpfs container was removed. The unchanged approved resource namespace
is now being used. The corrected red run reproduces seven real regressions,
with one existing late-start case passing and 25 unrelated cases skipped. The
owned tmpfs target was removed. Log: %TEMP%/aat-recorded-work-red-approved.log.

The source fix respects actual starts in technician and equipment occupancy and
keeps recorded completion/cancellation cleanup and allocation history. Its green
run was blocked before starting: C: abruptly fell to about 12.1 GiB. Docker VHDX
remains 30.16 GiB; pagefile.sys is now 27.86 GiB and changed during the interval,
making Windows paging a strong suspect without an earlier size snapshot. No
system paging setting/file or other task was modified. Paging later shrank from
27.86 to 18.35 GiB as host free space recovered by about 9.4 GiB. The 22 GiB
image-build allowance still does not pass at about 21.5 GiB free.

Hosted source e0d9ad33 passes all 33 resource-lifecycle, 10 slot-timing and nine
booking-timing cases inside the restricted-runtime acceptance stage. Its later
learning stage finds one stale Allie guide-version assertion (10 instead of 11),
now corrected without dropping role/target/behavior checks. All 24 focused Allie,
resource-guide and reschedule-guide units pass locally with a 512 MiB Node heap
cap and passing disk preflight. Final complete exact-source checks remain pending.

Staff booking-confirmation guidance is v11; its gate/target are unchanged and the
owner resource-plan guide remains draft. This is not completion of D06/D07: actual
resource facts/owner configuration, running-job estimate/resource review and legacy
operational assessment remain separate work. No financial activation, migration,
real staff assignment or physical attendance is inferred.

### 4 November 2026: D06 resource-aware public offers — integrated source checkpoint

Current source combines resource discovery with master 92f3f9fc, preserving the
new Help/Allie dock, dashboard/account, image, financial and resource-authoring
fixes. No Prisma schema or migration differs from master; all 97 canonical
migrations remain. Full D01-D17 remains active. Next work includes D06/D07 ongoing
work/legacy assessment, then the remaining materials, arrival, lead-time,
collection and exception journeys; this checkpoint does not redefine completion.

Public offered times now require the currently approved resource plan, explicit
service assessment, current qualified job duty, working periods/absences and
available distinct equipment/shared spaces for preparation/job/cleanup. Discovery
reuses confirmation occupancy and maximum matching, including actual completion
cleanup, overdue unfinished work and unassessed overlapping legacy work. A single
repeatable-read snapshot covers calendar, plan, eligibility, candidate batches and
public projection. Filtering precedes output pagination and scans beyond an
exhausted batch; public output/cursors contain no resource, staff or other-customer
identities. Existing private/no-store response and booking window are retained.

Selected offers are rechecked without reserving a unit or creating payment.
Changed offers reject before a booking write. An unconfirmed preferred-time
request remains available when resources are not configured. Atomic confirmation,
original reschedule reservations, permission predicates, history and financial
safeguards remain. Workforce permission checks still precede availability errors;
existing 403 and rollback regressions were preserved rather than weakened.

Native evidence covers 125 distinct cases across runs: the preceding full run
passed the other 100 booking/resource-policy/lookup/workforce cases, and the final
resource lifecycle/discovery run passes 25/25 after correcting three fixture
assumptions. Each fresh target replayed all 97 migrations and passed Prisma diff,
db:check and restricted-runtime proof. Final log:
%TEMP%/aat-resource-aware-offers-focused-native.log. Earlier attempts retain the
fixture naming collision, SQL-expression cast error, permission ordering error,
missing required legacy confirmation timestamp and tests outside the preserved
7–14 day booking window. No assertion was waived or policy changed to obtain a
pass. All task-owned tmpfs databases were removed; application data was untouched.
51 resource/learning/role units, source/scripts types, full backend lint, API
validation (446 paths/522 operations) and 3,842-file secret scan pass. API request,
response and security contracts are unchanged.

Service-request guidance is v26, with unchanged public eligibility and semantic
targets. Owner resource-plan v1 stays draft; flags remain unchanged. See
docs/help-learn/WORKSHOP_RESOURCE_AVAILABILITY_20261103.md. Exact-master hosted
checks and production publication remain pending for this composition. Actual
qualified staff/resources/shifts need factual owner configuration and real-role
acceptance. Booking readiness remains separate from invoice identity, tax and
provider/financial activation prerequisites. No new pricing, stock, approval,
provider success or real physical attendance is inferred.

### 3 November 2026: resource authoring reconciled with current master

The signed resource lookup/editor checkpoints were cherry-picked onto current
master 3be68d5d, then merged with d9cf9d09 in b9c9c089. This preserves the newer
purchasing reviews, canonical 97 migrations, saved monetary allocations, approved
rounding rule, own-profile access, home imagery and audit fixes. The alternate
20261103103000 prototype migration stays only on the retained historical branch;
it is not merged over master. Other active page-audit work remains untouched.
Both financial and resource tests are retained in the combined CI configurations.

Pre-financial-merge source 418705dc passed all 116 native booking/resource HTTP and
database cases on an exact task-owned temporary isolated database after all 97
migrations replayed, Prisma diff and db:check passed, and a restricted CRUD runtime
was verified. The initial 107-pass run retained one Docker identity timeout;
an attempted reuse failed test authentication and was cleaned up. The final full
run passed without skips and removed its exact tmpfs container. No application,
shared or production database was written. Final log:
%TEMP%/aat-resource-current-master-native-final.log.

D09 prevents customer cancellation after a recorded start even if a legacy status
still says Confirmed; D15 skips missed one-hour reminders instead of sending them
immediately. No cutoff or proposed extra reminder interval is activated. The screen
now checks the recorded start, with two new 320/1440px refresh regressions. Public
service-request guidance advances to v24 with unchanged gates/targets. Exact-source
post-merge frontend/backend compilers, 33 focused frontend and 49 backend unit
cases, scoped frontend/full backend lint, formatting and a 3,839-file secret scan
pass. The old v23 learning assertion initially failed and was updated to the
explicit v24 definition; its final 12-case file passes. Hosted rendered checks
remain pending until recorded.
The previous 19-case editor browser result remains synthetic pre-integration
acceptance, not evidence for this new composition or real operational accounts.

Read-only Vercel checks identify both aliases at audit source 7384abf8. Its
recorded backend receipt is schema 92; no fresh backend schema probe is claimed;
this resource/97-migration composition has not been deployed. Exact-master CI,
fresh backup, populated restore, reviewed pending migrations, matching backend and
runtime/alias verification are still required. Resource-aware public offer
filtering and remaining D01-D17 items are not marked complete. Purchasing remains
separately gated; the owner's approved aggregate half-up/largest-remainder rule is
preserved, while invoice identities, VAT applicability and provider acceptance
remain separate. Historical evidence below retains its original source/migration
counts and does not supersede this current checkpoint.

### 3 November 2026: D06 owner resource editor checkpoint

The source owner editor now covers real-record selection, explicit qualifications,
physical condition/calendars, versioned approval and reference-only uncertain-save
recovery. Local evidence (19 rendered, 70 frontend and 22 backend learning tests) is in
the completion tracker.
Operational resource facts/configuration, public offer filtering and D07 extension/
legacy workflows remain; no production readiness or publication is claimed.
D01-D17 approvals, delegated choices and unresolved values below are preserved.

### 3 November 2026: D06 authoring foundation checkpoint

Real-record owner-only lookup, strict resource approval receipts and reference-only
recovery are locally verified: 18 native resource-policy/lookup and 43 frontend
contract/API tests pass. The authoring UI and public resource-aware offer filtering
remain implementation work; no operational approval, UI acceptance or production
publication is claimed. D01-D17 instructions, delegation and unresolved values below
are unchanged. See the completion tracker for exact evidence and failed attempts.

## 3 November 2026: owner-approved monetary arithmetic

The user explicitly selected "Use the recommended rule" in this chat after
reviewing the concrete proposal: for future orders, round the percentage discount
and VAT once per order to the nearest kobo, resolve exact halves upward, and
allocate partial refunds by largest fractional remainder, breaking ties by the
saved line order. Allocations must reconcile to saved totals. Issued historical
amounts remain unchanged. This resolves the former tie/boundary/allocation question;
do not request that decision again. Implement the same saved snapshot across
review, payment, invoice/receipt, verification and refunds.

This is owner decision evidence, not a fabricated runtime publisher or policy
activation. Live payments and existing controlled finance settings remain unchanged.
Actual invoice identity, VAT exceptions and provider/operational acceptance retain
their separate unresolved requirements.

# Remaining owner and operator decisions

The signed checklist and attachment were implemented with explicit gates. These are unresolved details, not a request to repeat already approved decisions. Record new approvals with source, evidence, effective time and a verified approver; never edit old policy versions.

1. **Delivery (Q1):** actual approved areas and fixed fees. Collection is 133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State.
2. **Vehicles (Q3):** confirm or replace draft 70% deposit/2-hour hold; choose paid-hold start, expiry disposition and delayed provider-confirmation treatment. Clarify professional review and refundable fee handling; 0.5% is of vehicle value, not deposit. Real collection remains blocked.
3. **Refund staff (Q4):** map Operations Supervisor, Managing Director and Cashier duties to distinct verified MFA accounts. Supply actual account IDs through the owner process; no guessed invitations.
4. **Workshop (Q5 / D05–D07):** Monday–Saturday 08:00–18:00 Africa/Lagos is already approved; do not ask the normal hours again. Record actual per-branch daily capacity, dated exceptions/holidays, qualified staff and breaks, each machine’s working condition and shared-space constraints through the owner authoring controls. The prepared resource editor is now integrated in source; actual operating facts still require authorised entry and acceptance. An unspecified response target must not become a customer promise.
5. **Cancellation and returns (Q6):** exactly NGN100,000; item versus order, unit versus line/quantity, VAT/discount and partial treatment; precise confirmation event. Confirm collection return anchor, inclusive 14-day boundary and defective-item/mandatory-rights review.
6. **Bank refund timing (Q6):** interpret ?10 business days after refund is received or confirmed?; approve start event, counting convention, banking days and holiday calendar. No due date is promised until those inputs exist.
7. **Accounting (Q7?8):** resolve genuine applicability/exceptions, discount/delivery tax treatment, registered invoice identity and terms. Exclusive 7.5% VAT after discounts, seven-day quotations and the arithmetic above are already approved. Public checkout/invoice issue stays blocked until approval.
8. **Disputes/complaints (Q9/Q11):** map Newworld Orlu/Confidence Olaka to actual primary/backup accounts; supply pending customer-service/escalation emails, working-day coverage, urgent classes, public holidays and ordinary business-day meaning. Acknowledgement is separate from resolution.
9. **Marketing (Q12):** approve content, consent wording/version, sender identity and unsubscribe mechanism. Marketing execution remains disabled; essential messages remain available.
10. **Retention (Q13):** legal/accounting rules by record type, start events, holds and reviewed anonymization/deletion. The provisional 6?12 months is not an operative purge policy. Destructive execution remains disabled.

Mike's separate staging tasks are in [the runbook](owner-staging-runbook.md): real provider credentials, private cloud resources, ingress/TLS verification, controlled testers, backups and operational responders. No cloud purchase, deployment or live activation was performed.
