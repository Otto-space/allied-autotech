# Payment invariants

The server derives every payable amount, currency, purpose, customer, and business reference from
the locked order, issued invoice, or committed vehicle transaction. Clients may select an eligible
payable and payment channel, but cannot supply authoritative financial values. All API monetary
values are decimal digit strings representing integer kobo; the persisted currency is `NGN`.

Payment intent creation, provider initialization, verification, manual-payment submission, and
refund requests require an `Idempotency-Key`. Only an HMAC and request fingerprint are persisted.
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
local verified attempts with provider results in bounded batches and reports missing or mismatched
records for investigation rather than silently rewriting history.

All financial transitions, manual reviews, evidence reads, refund decisions, disputes, anomalies,
and reconciliation activity retain actor/request correlation where available. Client responses and
logs expose neither secrets nor unrestricted customer, object-storage, or provider data.
