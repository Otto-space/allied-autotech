# Cancelled original supply reconciliation

13 November 2026. Implemented under bounded D17 delegation. This is not general
returns/warranty approval, financial-duty assignment or purchasing activation.

## Customer and operator journey

An already cancelled collection order, with its actual cancellation date and no
recorded physical handover, has a distinct payment review. A current assured
administrator reviews current original-order and financial evidence, an internal
reason, explicit confirmation and the normal mutation review. The existing CSRF,
branch/current-identity, order-version and UUID replay protections remain. This
records an append-only financial closure event; it never creates a handover,
refund, stock return, replacement credit or a new amount due. The actual original
cancellation reason/date, prices, tax, discount, reservations and journals remain.

- **No captured payment recorded:** no payment attempt exists; any original intent
  is actually cancelled/expired with its corresponding timestamp, without settled
  identity or successful-payment facts. Original paidAt and consumed stock refuse
  this outcome. A failed, abandoned or unverified attempt alone is never negative
  bank evidence. Customers who paid or see a bank debit must contact Care.
- **Captured funds returned:** every actual capture is verified against its own
  canonical credit and the actual original payment. Each capture must have its
  own full independently settled refunds and canonical debits, with no fee or
  forced credit. Whole-order legacy/technical refunds need no invented per-unit
  tax allocation. Actual captured totals are shown separately from contract price.
  Human manual refunds keep separate requester/approver/transfer/check identities;
  technical Paystack reversals require their saved approved order-payment policy.
- Unknown/pending attempts, busy evidence, active claims/allocations, open financial
  anomalies, unresolved disputes, technical/used/installed cases or unaccepted
  alternative choices remain held. The original order cannot be recharged or
  fulfilled. Any separately accepted replacement rechecks current original proof
  before payment/fulfilment; later money or conflicting evidence invalidates it.

## Cancellation refund recovery and policy boundaries

The existing free pre-confirmation customer cancellation kernel requests the full
remaining actual captured amount, even when recovering a cancellation already
recorded before a late capture. The former supply-link guard blocked that request.
The forward fix admits only REQUESTED HUMAN refunds tied to the original buyer,
actual pre-confirmation whole cancellation and its audit, exact remaining capture,
actual saved zero-fee policy settings and no physical/technical/dispute conflict.
Separate approval, manual transfer/checking, provider eligibility and amount caps
remain. It neither approves pending general cancellation terms nor creates an
unrestricted unbound refund path. Guest-specific recovery and cases lacking actual
financial facts remain with their existing authorised Care/finance workflow.

## Storage and compatibility

Forward SQL migrations 124-128 extend existing immutable OrderSupplyClosure JSON
with ORDER_CANCELLED_SUPPLY_RECONCILIATION_V1. Earlier replayed migration files are
unchanged; successive forward corrections preserve that history. No Prisma model
or generated-client shape changes. V1 positive-refund/unit closure remains distinct.
Current SQL proof is checked again by the insertion and deferred atomic-outcome
guards. Financial evidence queries use a savepoint so an unavailable review cannot
leave the staff read transaction aborted. Saved JSONB comparisons ignore key order.

Public/account/guest responses contain only recorded date, outcome, original and
actual captured/refunded totals and cancelled-unit count. Notes, operators,
sessions, hashes, capture/refund ledger identities and raw proof remain private.
Only administrators receive a current review preview. Buyer choice editing stops
after recorded cancelled-order reconciliation; an earlier same-body replay remains.

## Learning and acceptance checkpoint

Customer parts collection v6, staff collection v5, administrator sourcing v9 and
restricted refund-work v10 explain these differences. Guide gates, semantic targets,
practice permissions and publication flags are unchanged. Broader policy stays
pending and bank-refund calendars are not inferred from the collection calendar.

52 learning/calendar/timing/role cases and 29 combined supply/review UI units pass. Source and
focused frontend types/lint pass at their recorded checkpoints. Fresh 127-migration empty replay/schema diff/db:check and 148/148 native cases
across 11 files pass; owned tmpfs cleanup verified. Rendered held-candidate verification, integrated exact-source checks,
fresh backup/off-device recovery/restore/migration/runtime gates remain pending at
this source checkpoint. Native tests use only newly created loopback _test targets,
reused postgres:18 and owned tmpfs storage with verified cleanup. Provider responses
and original captures in fixtures are synthetic, not real bank/provider acceptance.
No production database, alias, stock, permission or real financial record changed.


## Final bounded verification

The current128 replay/schema diff/db:check passes. The expanded native run passes
147 cases and reaches the final duplicate-history assertion in the remaining case;
updating that expected count from1 to2 yields a passing focused rerun with exit0.
These establish148 unique verified native cases across the runs, not one all-green
full128 command. The duplicate test uses actual separate approval/transfer/check
services, preserves the original320-kobo contract/selected receipt, records640
actual captured/refunded kobo separately and retains both immutable reviews.
Manual captures require their own actual approved review; unknown/busy/disputed
money stays held even when an apparent refund has been recorded.

Held runtime4729e4bd / dpl_C3SFP4jtDNhiXZBVKHV684nGdsWr passes27 rendered cases.
A source/held RED regression verified the misleading legacy refund copy; the final
copy and recovery pass. Corrected no-capture dates/payment references/invoice
fixtures pass14 further checks of the same14 new cases; they are not counted as
additional unique coverage. Screenshots were inspected. Temporary access revoked
and cookie files removed. Receipts are under TEMP/aat-d03-service-payments-20261109:
native-cancelled-supply-128.log, native-cancelled-duplicate-focused.log,
cancelled-final-held-browser.log, cancelled-truth-held-browser.log and
cancelled-copy-baseline.log. The corrected screenshots are under
cancelled-truth-held-results; People focus captures remain under
cancelled-final-held-results. Protected fixtures do not prove real users, bank or
provider acceptance, physical devices, or purchasing readiness.
