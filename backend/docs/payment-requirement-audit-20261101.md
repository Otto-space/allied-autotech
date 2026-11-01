# Final payment requirement audit - 1 November 2026

This is source and isolated-test evidence, not merchant activation or real money movement.

| Requirement                      | Implementation and checked assertions                                                                                                                                                                       | Evidence / limit                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trusted amounts and ownership    | PaymentsService locks stored target and payment, derives integer NGN amount and rejects another customer's payment; strict create schema rejects client amount/purpose forgery                              | phase8-payment-security; payment-target-concurrency; current isolated CI                                                                                      |
| Signed webhook ingress           | HMAC SHA-512 over exact raw bytes, constant-time comparison, invalid or altered bytes rejected                                                                                                              | phase8-payment-security unit assertions inspected and passed                                                                                                  |
| Correct provider identity        | Paystack adapter validates requested reference and test/live domain; numeric IDs retain exact string identity                                                                                               | paystack-identity; 67 focused payment unit checks passed across three files                                                                                   |
| Duplicate and early callbacks    | Provider receipt uniqueness and locks prevent second ledger entry/allocation; early successful, pending, failed and abandoned verification remains authoritative when initialization completes              | payment-capture-accounting and payment-initialization-race assertions inspected; current isolated CI                                                          |
| Delayed or reversed observations | Reconciliation covers more than 1,000 attempts, validates reference, preserves captures, records differences/holds and retries provider unavailability; it does not invent refunds or prove bank settlement | payment-reconciliation and webhook-financial-ownership; prior 41-case isolated evidence; current CI covers reconciliation                                     |
| Booking and notifications        | Preferred request remains pending; staff capacity and authority govern confirmation. Queue failure rolls back proposal/notification without erasing the existing booking; retry commits one notification    | workforce-booking-confirmation assertions inspected; prior 19-case real HTTP evidence. Delivery worker is separate; real email acceptance remains outstanding |

No new payment runtime change was needed for this audit. Independent provider
contract tests and reviewed CI assertions do not substitute for Paystack merchant
NGN eligibility, matching test credentials/mode, configured callback/webhook,
provider test-mode acceptance, settlement checks or separately reviewed live activation.
Booking deposits remain disabled under the owner's request-and-confirm policy.
A saved request does not require payment configuration and is not a confirmed slot.

OpenAI remains a separate activation: server key/model/project access, billing,
retention notice, consistent feature/quota configuration, healthy retention worker
and a new explicitly bounded evaluation allowance. The previous 120 reservations
are exhausted. No new paid model call, charge, refund or customer message was made.
