# Payment invariants

The server derives every payable amount, currency, purpose, customer, and business reference from
the locked order, issued invoice, or committed vehicle transaction. Clients may select an eligible
payable and payment channel, but cannot supply authoritative financial values. All API monetary
values are decimal digit strings representing integer kobo; the persisted currency is `NGN`.

Payment intent creation, provider initialization, manual-payment submission, and refund requests
require an `Idempotency-Key`. Verification uses the stored attempt reference, row/receipt locks
and immutable facts rather than a client idempotency key. Only a key HMAC and request fingerprint are persisted.
Reusing a key with different input is rejected. Payment references are server-generated and provider
authorization material is returned only to the owning customer.

Paystack and Monnify are called only from the server. A successful API response or browser redirect
is not settlement by itself:
reference, amount, currency, provider status, and payable identity must match server truth. Webhook
signatures are verified over the exact raw request bytes using the provider's HMAC policy before
trusted processing. Monnify sandbox may omit a signature, so those events can only trigger
authoritative server-to-server verification and never settle directly. Parsed provider payloads use
strict allowlists; raw payloads, authorization data, and provider responses are never persisted or logged.

Webhook identities are immutable and deduplicated. Duplicate delivery is safe, while an event that
does not match its attempt creates an anomaly instead of changing financial state. Capture, refund,
chargeback, and reversal ledger entries are append-only. A payable can settle only from a verified
capture or an independently approved manual payment, and repeated processing cannot create a second
capture entry.

Online receipt identity is `(provider, gatewayTransactionId)`. A transaction advisory lock
serializes competing references, and a partial unique database index permits only one successful
online attempt for that identity, including amount mismatches. The second claim becomes a retained
`REUSED_PROVIDER_TRANSACTION` observation and verification hold; it creates no second capture or
payable allocation. The same identifier in two different providers is not a collision. A replay of
contradictory legacy successful rows records an anomaly rather than backfilling another capture.

Paystack numeric IDs are preserved from their original JSON tokens as strings using the Node 24
reviver source context, before JavaScript number rounding can change their identity. Both webhook
and adapter parsers share this behavior; monetary fields retain their strict integer checks. See
the [Paystack transaction ID contract](https://paystack.com/docs/api/transaction/).

Manual-payment submission is evidence, not settlement. Evidence lives in private object storage and
is accepted only after size, MIME type, checksum, and upload-signature verification. Evidence access
requires an MFA-assured, branch-authorized staff actor and produces an audit event. The submitter may
not approve the same payment.

Refund requests lock the captured attempt and include pending, approved, submitted, and completed
refunds when calculating the committed total. The database rejects totals above the verified captured
amount. The requester cannot approve the same refund. Paystack and Monnify refunds remain pending
until verified provider evidence is processed; manual refunds enter `NEEDS_ATTENTION` for an explicit offline
completion workflow and are never assumed complete.

Disputes are keyed by provider identity and maintain explicit state. Chargebacks create immutable
ledger entries and adjust payment state transactionally. Reconciliation is read-only: it compares
local attempts with provider results in 250-record batches across the full selected initiation
period (`start <= initiatedAt < end`, created no later than the run start). Its timestamp/UUID
keyset handles tied timestamps without a 1,000-record coverage limit. Each batch observes current
local state; sequential provider lookups are not a global transactional snapshot.

Reconciliation item amounts and run totals represent received NGN funds, not requested order
values: confirmed local receipts use `verifiedAmountKobo`; only positive provider successes for
the requested reference and NGN currency enter provider totals. Known non-successes contribute
zero. Unavailable or unallocatable observations have a null provider item amount and contribute
nothing to the total. A matching pair of received totals does not erase an underpayment or an
existing verification hold. Database write failures fail the run instead of masquerading as
provider outages. Reconciliation never changes captures, allocations, holds or refunds.

Each new reconciliation item also retains the observed provider transaction ID. An eligible
provider receipt contributes once per run across all batches; a receipt already confirmed for
another local attempt is excluded, even when that attempt lies outside the selected period.
Duplicate observations remain visible with a null provider amount and a difference status.

This interface verifies local references; it cannot enumerate provider-only transactions or
prove bank settlement. Initiation-period totals are not capture-date revenue. Worker scheduling
gaps, failed-run recovery for the same unique period and approved review-hold resolution remain
separate operational requirements.

All financial transitions, manual reviews, evidence reads, refund decisions, disputes, anomalies,
and reconciliation activity retain actor/request correlation where available. Client responses and
logs expose neither secrets nor unrestricted customer, object-storage, or provider data.
