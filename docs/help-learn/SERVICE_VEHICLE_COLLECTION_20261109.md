# D03 vehicle collection and supplemental payment completion

Unpublished source after 26e54fe7, 9 November 2026. The full D01-D17 goal stays active.

## Requirement and authority

Section 7.2 requires agreed materials first, authorised agreed work, workmanship
settlement after completion and before vehicle collection. It proposes, rather than
independently approves, every procurement timing detail. Existing verified-materials
checks before work using those materials remain. Earlier tracker wording overstated
a separate inventory issue/use ledger as a launch requirement. Such a ledger is an
optional operational extension; this batch does not invent stock movements or claim
that invoice payment establishes actual installation. Existing work/quality records
remain the evidence of recorded work. No source requirement or financial safeguard
is removed by this clarification.

The initial collection recorder is restricted to the existing service-administrator
roles (Admin/Super Admin) with actual current account/session/MFA verification.
That is a bounded engineering choice under delegation, not a newly claimed owner
permission approval. Staff/technicians gain no release or financial approval power.
Identity and collection authority are explicitly reviewed by the human operator;
the website does not independently identify a person or physically move a vehicle.

## Source behavior

A protected readiness read checks actual booking AND work-order completion, complete
accepted work scope, all original and separately accepted additional invoices, exact
verified settlement of both stages, genuine saved historical credit, and financial
holds. Settled-attempt proof uses the existing nonblocking shared locks under the
Booking -> Invoice order; busy verification is refused, never partially accepted.
Readiness returns a booking version and financial review fingerprint, without
private payment identifiers or amounts. It is not a collection record or charge.

The operator reviews the actual collector name and internal identity/authority note,
then confirms at handover. Confirmation rechecks current access, completion, review
version/fingerprint and every obligation. One immutable booking-linked collection
record and an ordinary BOOKING audit entry are saved atomically with a version bump.
Exact source-key replay returns the same fact; changed reviews or competing keys
cannot create a second record. Later refunds/adjustments retain the historical fact.
No invoice, payment, price, grant, inventory quantity or activation flag is changed.

Migration 105 adds the nullable booking relation and append-only collection table,
FKs, source-key uniqueness, basic completion/issued-balance checks and immutable
history. The preceding 104 migrations are unchanged. The application performs the
stronger current-session, verified receipt/credit/stage and financial-hold checks.
A SQL shape guard alone is not described as complete payment verification. Public
customer/staff booking projections expose only collection ID/time; the financial
snapshot and verification note remain server-side. No legacy invoice is rewritten:
unstaged historical invoices and corrective financial changes require authorised
review before this new recording path can claim clearance.

The UI first checks readiness, then reveals the collector review. Successful checks
focus the first input. Identity selection reveals the review action. Confirmation
focuses the recorded result after a fresh booking read; passive reload does not
refocus it. Uncertain/wrong-bound responses require checking the current record
before handover; they never show an invented successful collection. The existing
container-focus policy suppresses panel-sized rings while preserving control focus.

A separate customer payment bug found by hosted acceptance is corrected: the final
pre-submit recheck accepts the matching supplemental source, not only an original
booking source. It binds the quotation, underlying booking, original invoice
reference and reason alongside the existing version/stage/amount/expiry checks.
Four browser regressions refuse changed context before any payment request is sent.

Service-request v34 remains twelve steps/7,909 passage characters under the existing
8,000-character retrieval budget. New service-vehicle-collection v1 is admin-only;
public/customer/staff catalogues omit it. Learning does not grant permissions and
no tutorial/practice/AI/payment flag is activated.

## Actual evidence and failures

Artifacts: `%TEMP%/aat-d03-service-payments-20261109/`.

- Earlier frontend hosted run 42669406067 on fe210127 passes static checks, 1,529
  units (twelve skips), production build, formatting and WebKit prechecks. Its full
  browser matrix has 581 passes/two supplemental-payment failures at 320/1440px.
  This is not a passing browser gate. Those failures reveal the original-booking-
  only recheck described above; no deadline or assertion is relaxed.
- Initial schema-105 isolated collection run passes replay/diff/db:check/restricted
  runtime, then has 43 passes/one failure because the new HTTP test omitted its local
  `createApp()` fixture. The fixture is corrected without weakening its checks.
- The reviewed focused run passes 44/44 in two files, including real isolated HTTP
  CSRF/customer denial, concurrent collection, immutable history, genuine credit,
  stale/uncertain finance and current-session refusal. Its owned tmpfs DB is removed.
- Final pre-integration `native-collection-final.log` passes 288 cases with five
  provisioned-workspace skips across 23 files (22 pass/one skipped file). All 105
  migrations replay, diff/db:check/restricted runtime pass and the owned tmpfs target
  is removed. The additional-work case proves that paid supplemental workmanship
  cannot cover unpaid original workmanship, then records one collection after both
  obligations settle without reusing the 6,000-kobo historical credit.
- Final focused learning/retrieval/resource guidance passes 68/68 in eight files.
  Canonical contracts validate 454 paths/534 mounted operations; client types are
  regenerated. Backend types/lint and frontend nonincremental types/scoped lint pass.
  New UI scenarios are source fixtures awaiting exact-source hosted execution.

No new local preview/profile/build/installation is created under current disk
pressure. Existing task listeners remain stopped; shared resources and the owner's
separate 79-line Desktop hero change remain. Master has advanced to b362e9f8 with
optional product sourcing/preparation estimates; integrate and verify that source
before publication. Pre-integration evidence above is not merged-source acceptance.

## Held publication and remaining goal

No production migration, domain promotion, provider call or real collection occurs.
The complete combined source still needs exact-source hosted browser/backend gates,
rendered artifact review, real-role acceptance where accessible, and normal protected
release/backup/restore/privilege/compatible-recovery safeguards. Tax ID, applicable
CAC and tax applicability still need genuine owner/accountant verification; purchasing
activation stays gated. Booking readiness remains separate. Per-order sourcing,
holding clock/calendar details, private one-time parts pickup and bounded exceptions
remain in the full goal; this vehicle recording path does not substitute for D14.
