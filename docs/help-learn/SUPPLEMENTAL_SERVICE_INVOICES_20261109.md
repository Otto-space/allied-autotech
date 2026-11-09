# D03 separately billed accepted additions

Unpublished implementation, 9 November 2026, following checkpoint 1d9e4cf2.
The goal remains the complete D01-D17 owner handoff, not this financial slice.

## Approved rule and engineering choices

The owner approved materials separately first and workmanship after completed work,
before collection. New work/amounts need reviewed customer agreement. Keep original
records, VAT, receipts and genuine historical credits; no silent extras or duplicate
sale. This source does not approve tax identifiers, activate a provider, enable
purchasing, create a deposit or give technicians financial access.

A supplemental invoice uses its explicitly accepted additional quotation as a
separate unique source. The original one-invoice-per-booking constraint remains.
Only new items and their agreed tax are copied; the original invoice/document,
quotation and payments stay intact. A previous booking credit is never reused.
The invoice names the original invoice and the customer-visible amendment reason.
Existing authorised Admin/Super Admin authoring, review/issue, CSRF, finance gate,
customer ownership, no-store/audit, document and staged-payment paths are reused.
Ordinary staff still cannot create/issue invoices or read administrator finance.
Managed financial visibility requires the existing actual grant and branch scope.

Original and supplementary payments share Booking -> Invoice lock order. Original
agreement/current ownership/private consent and financial adjustments are checked
before issue or payment preparation. Settled proof uses nonblocking shared locks,
refusing busy verification instead of waiting while holding Booking. Late captured
money is recorded for reconciliation when the original was voided, never erased or
silently allocated. A payment request is not a successful payment or receipt.

Work authorisation includes separately issued/paid accepted additions. Each
obligation needs its own verified materials payment. Identical rows are allocated
original agreement first, then accepted addition version order. This deterministic
quantity allocation is an engineering choice, not a new owner price/credit rule.
One paid original quantity cannot authorise an unpaid additional quantity. Agreed
labour-only work remains separate. Completion requires all agreed work and refuses
accepted additions still awaiting a reviewed invoice. Physical material issue/use
and actual vehicle release remain distinct unfinished implementation.

Migration 103 adds only the nullable unique additional-quotation source/relation
and forward checks/triggers. The original 102 migration files are unchanged.
Every invoice still has exactly one source, and each addition can be invoiced at
most once, including after voiding a draft. Credits/guest ownership cannot be
attached to a supplement. Its source and saved document are immutable. Source
amount/customer/currency checks retain all original order/guest/credit/refund
protections and add exact current additional-work consent checks. A saved plan and
original reference/reason are required. New invoices are not a historical backfill.
Normal publication, backup/restore, compatible runtime recovery and exact-master
checks are still required; older clients/runtimes must not reinterpret new sources.

Customer/staff invoice lists, source selection, recovery markers, details, printable
papers and PDFs recognise additional work. Customer payment review still sends the
exact saved stage/version/amount and obeys the existing capability gates. Missing
stage/context or conflicting original references fail closed. The original invoice
linkage/reason must agree between the readable invoice and its document. New source
selection/reload recovery cannot create another invoice merely to clear uncertainty.

Service-request v33 and restricted financial-policy-work v9 explain the separate
obligations. Eligibility and existing guide targets/permission gates remain intact.
Guidance does not allocate inventory or authorise physical release.

## Remaining acceptance and scope

Fresh isolated schema-104 acceptance, current types/lint/contracts, rendered
customer/staff/source-recovery checks and safe artifacts are recorded after their
terminal results. No pending run is counted as a passing gate.

Historical originals without a valid saved staged plan require financial review;
this source never fabricates or retrofits an allocation. Voided accepted additions
and reductions/corrective financial changes require controlled review, not a second
invoice for the same source. Neither hold is described as a new owner approval.
Full D03 still needs actual materials issue/use, durable authorised cleared-balance
vehicle release and final combined acceptance/release/provider safeguards. Tax ID,
applicable CAC details and tax applicability remain verified-owner/accountant inputs.
General returns/warranty policy remains deferred. Booking readiness is separate
from purchasing readiness. No production write or live capability activation.

## Acceptance history

Artifacts remain in `%TEMP%/aat-d03-service-payments-20261109/`.
The first `native-supplemental-invoices.log` replays all 103 migrations and passes
schema diff/db:check/restricted-runtime checks. It runs 17 files: 233 passing,
five failing and five skipped cases. It is not a passing gate. Three failures
observe the old Invoice wait instead of the intentional Booking-before-Invoice
lock; their probe now observes Booking while retaining all cancellation/no-write/
no-provider assertions and the 3-second deadline. The new credit-injection HTTP
test expected 400 instead of the actual existing strict-validation 422 contract.
The public guide's new internal-role wording matched a capability-search sentinel;
customer language now says the workshop issues the invoice, retaining the strong
privacy assertion. The five managed-finance cases require a separately provisioned
workspace fixture and are not represented as role acceptance. No fixture evidence
or grant was fabricated to enable them. The owned tmpfs container was removed.

Frontend invoice/source/document units pass 14/14 in three files (15.48 seconds).
Scoped lint passes on the touched components, schemas and browser fixtures. Initial
canonical contracts validate 452 paths/532 operations; new source client types were
generated. Initial frontend typing found the old three-source recovery-marker
enum; recovery now reuses the shared source enum, preserving old saved markers.
Final source typing/rendered and combined acceptance are recorded separately.

The first focused rerun has 63 passing/four failing cases: changing the common wait
probe also affected tests which deliberately lock Invoice directly. The probe now
distinguishes that direct-row case from the actual operator's Booking-first path;
all deadlines and no-write/no-provider assertions remain. The synthetic HTTP
session used an MFA timestamp older than its chosen creation time; its creation
time now respects the actual fixture verification timestamp instead of weakening
the session constraint. A recovered focused run passes 66/67; its sole remaining
failure is the new test's expected reconciliation amount. The fixture's historical
credit is 6,000 kobo (30 percent of 20,000), not 3,000. Original net 15,500 plus new
16,125 gives 31,625 received on invoices; the previous 6,000 credit is not collected
again. The test now asserts that actual historical credit and exact total.

A separate review run replays schema 103 and passes diff/db:check but is stopped
before tests by the mandatory reserve check. Frontend typing is also stopped before
execution when C: drops to 11.82 GiB. Both processes are terminal and the owned DB
container is removed. No blocked stage is counted as tested. Native npm-cache
verification checks 3,540 entries/1,950,070,362 bytes and reports no reclaimed-content
count. C: later measures 21.10 GiB; that change is not attributed to the cache command
without a before/after allocation snapshot. Docker remains 151 images/13.82 GB and
451 build-cache records/14.05 GB. Windows pagefile allocation measures 19,844 MiB,
later 18,864 MiB. These observations do not prove the exact cause of the disk drop.
All other processes, compiler caches, Docker images/caches/volumes and protected
history/data are retained. No previously rejected deletion is retried.

Migration 104 separately guards new additional acceptance and supplemental draft
creation/issue after either booking or work-order completion. It preserves the
first 103 migrations. An old completion cannot authorise newly agreed workmanship.
Original invoice paths and settlement of already issued additions after completion
remain available. Closed quotations stay readable and rejectable; no old visit or
approval is silently reopened. The customer UI uses existing booking/work-order
status facts and shows the boundary. This ordering is an explicit engineering
safeguard, not a newly fabricated owner financial-policy approval.

Final isolated native acceptance (`native-supplemental-final.log`) passes 273
cases, with five provisioned-workspace cases explicitly skipped, across 21 files
(20 passing/one skipped). All 104 migrations replay on a new owned tmpfs database;
schema diff, db:check and restricted runtime checks pass. The owned test container
is removed. This proves isolated database/workflow behavior, not production role,
provider or physical workshop acceptance. Frontend/rendered checks remain pending
for this checkpoint. Remote master now includes navigation readiness/layering and
a working-hours fixture repair (160d3b7b); integrate those without replacement.

## Integration and interrupted rendered acceptance

Checkpoint c3cfcc05 contains the supplemental source; merge 28b4bc80 retains all
master 160d3b7b navigation hydration/native-fallback/overlay repairs and the Lagos
working-hour test correction. The imported application, test and instruction files
match master byte-for-byte. Both continuity/quality histories and both browser
project families remain. Backend application/schema and invoice/booking API scopes
are unchanged from the 273-case tested checkpoint. The separate Desktop hero still
has the owner's 79 added lines and is untouched.

Frontend nonincremental types and 14/14 invoice units pass before the integration;
full frontend ESLint and merged backend typing/lint pass. The secret guard passes
3,912 files. Canonical contracts/types were regenerated (452 paths/532 operations).
Final merged frontend types/production build and rendered acceptance remain pending.

The local 29-case combined Edge attempt starts with the preserved navigation tests.
The first 1280px readiness case passes. At 1024px the opener remains disabled after
script release and the existing 20-second assertion fails. Screenshot and trace
are retained; this is not a passing navigation gate and its cause is unproven.
Before it completes, C: falls from 21.16 to 11.57 GiB. The agent stops its browser,
preview and read-only capability fixture. No owned process or listener remains on
5414/5415. A concurrent browser task in another worktree is observed and preserved.
The partial attempt cannot establish any invoice or closed-visit rendered acceptance.
No timeout or assertion is relaxed. Artifacts total 46,014,321 bytes, which cannot
explain the measured host drop. The pagefile reports 19,471 MiB allocated, without
a matching earlier physical-allocation baseline; no exact cause is claimed. C:
later measures approximately 21.05 GiB. No deletion is attempted or credited for
that recovery. Do not repeat this local browser workload under the same pressure;
use existing isolated hosted CI for exact-source acceptance. No protected data,
images/caches/volumes, pagefile or other task is modified.

Hosted frontend run 42668296246 on 91c80c8f passes full lint, types, 1,529 units
(twelve existing skips) and the optimized production build. Its final formatting
check fails only on two extra blank lines retained between merged quality-register
histories. Canonical Prettier removes those blank lines without changing either
history or application code. This failed run never reaches browser execution.
The corrected source needs a new hosted frontend gate; the earlier build is not
represented as complete release/browser acceptance. Secret run 42668296250 passes;
backend run 42668296194 remains in progress at this checkpoint.

Backend hosted run 42668296194 passes replay, schema/runtime/finance/booking,
authoring, pre-payment, guest, refunds, reconciliation and learning database stages,
then fails its final Care/Allie batch: 108 pass/five fail. All five failures are
existing all-audience retrieval coverage refusing service-request because its full
passage is 9,659 characters, above the unchanged 8,000-character budget. This is a
real help regression, not a successful backend gate. The unpublished v33 guidance
is shortened to 7,823 characters and retains twelve steps, original conditional
booking, privacy, payment, amendment, calendar and attendance restrictions. No
retrieval budget, permission, test assertion or publication flag changes. An initial
focused run passes 60/63 and identifies three retained exact-boundary phrases lost
during editing; the final wording restores these conditions. Final focused guide/
retrieval acceptance passes 67/67 across eight files (`guide-retrieval-final.log`),
including all public/customer/worker/Admin/owner catalogue coverage and the workshop
resource guide. Current hosted backend acceptance must be rerun for this correction.
Frontend formatting correction is fe210127; run 42669406067 is in progress.
