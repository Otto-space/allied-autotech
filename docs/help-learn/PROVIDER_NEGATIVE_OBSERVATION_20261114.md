# Provider-observed negative payment evidence - 14 November 2026

## Implemented boundary

The existing verified-provider path now appends private PaymentAttemptObservation
records under its attempt lock. Distinct results have a database sequence; identical
current results reuse their evidence. A new query after actual cancellation is
recorded even when it matches a pre-cancellation result. Observations are append-only;
no browser callback, staff status edit or queued task supplies these facts.

Forward migration129 preserves V1 proofs and adds V2 cancelled reconciliation only
when actual unsuccessful attempts exist. It requires the latest exact failed or
abandoned online observation after actual order cancellation, closed genuine
payment intents, matching reference/currency and no positive capture, bank fee,
refund, dispute or manual review. Paystack's requested amount must equal the bound
attempt; Monnify's amountPaid must be zero. Pending, reversed, mismatched and
unobserved attempts remain held. Monnify REVERSED is preserved as reversed, not failed.
Forward migration130 additionally preserves a hold for any historical possible funds, fee, paid timestamp or reversal on an unsuccessful attempt, even after a later matching negative. Any positive captures still need their complete independent full-return proof.

A no-capture review is not proof of bank absence or a refund. A later observation,
capture or discrepancy invalidates clearance. Existing original cancellation,
stock, handovers, financial duties, customer acceptance and activation gates remain.
No provider reference, raw observation, bank proof or private financial snapshot is
added to customer/guest output. No public contract or frontend interaction changed.

## Verification

- Fresh129 empty migration replay, schema diff and db:check pass on a unique
  loopback _test database in an owned tmpfs container, using restricted runtime.
- Four actual isolated service/provider-adapter journeys pass: Paystack and Monnify,
  each failed/abandoned. Pre-cancellation and mismatched amounts reject; current
  post-cancellation facts permit explicit review; repeat does not invalidate it.
  Pending and actual later capture invalidate it. Original amounts, zero invented
  refund/ledger money, immutable observations and private buyer projection asserted.
- Seven Monnify adapter/security unit cases pass, including actual parsed failed,
  expired and reversed provider envelopes. Initial new fixture envelopes omitted
  required response metadata; corrected fixtures pass without parser relaxation.
- 67 focused provider, guide/audience and collection-calendar units pass. Four stale
  guide-version expectations were corrected after versioned content changed;
  permission and content assertions remain.
- Initial schema129 broader financial/fulfilment regression run passes180/180 across14 files, including the real isolated payment/refund/pickup/concurrency services. A final schema130 full run now covers the additional historical-funds guard; its result and current exact-source hosted checks remain pending at this checkpoint. No production database/provider
  calls, public promotion, real payment/refund or permission change occurred.

## Learning and remaining scope

Customer parts-collection v7, staff-parts-collection v6, administrator sourcing v10
and restricted refund-work v11 retain their existing eligibility/targets/flags.
They explain current provider evidence, pending/reversal holds and later conflicts.
Historical partial monetary-breakdown reconciliation, operator/guest whole-order
recovery and actual independent role/provider/accounting acceptance remain separate.
General returns/warranty, bank calendar and unspecified cutoffs remain unapproved.
