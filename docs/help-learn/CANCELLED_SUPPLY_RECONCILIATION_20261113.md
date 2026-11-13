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

Forward SQL migrations 124-127 extend existing immutable OrderSupplyClosure JSON
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

52 learning/calendar/timing/role cases and 22 supply UI units pass. Source and
focused frontend types/lint pass at their recorded checkpoints. Fresh 127-migration empty replay/schema diff/db:check and 148/148 native cases
across 11 files pass; owned tmpfs cleanup verified. Rendered held-candidate verification, integrated exact-source checks,
fresh backup/off-device recovery/restore/migration/runtime gates remain pending at
this source checkpoint. Native tests use only newly created loopback _test targets,
reused postgres:18 and owned tmpfs storage with verified cleanup. Provider responses
and original captures in fixtures are synthetic, not real bank/provider acceptance.
No production database, alias, stock, permission or real financial record changed.
