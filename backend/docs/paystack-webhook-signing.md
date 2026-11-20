# Paystack webhook signing-secret compatibility

Status: review-only source change, 19 November 2026. Payment providers remain
disabled in the current public launch. This does not certify a provider test-mode
delivery, a production rollout, or any live settlement.

Paystack's current [webhook documentation](https://paystack.com/docs/payments/webhooks/)
describes a new `Paystack-Signature` header. It contains a Unix-second timestamp
(`t`) and one or more keyed HMAC-SHA512 values (`v1`); the HMAC covers
`timestamp + "." + original HTTP body bytes` with a separate `whsec_` signing
secret. A 300-second clock window limits replay. Paystack may include several
`v1` signatures during signing-secret rotation. The older
`x-paystack-signature` is an HMAC of the raw body using the **API** secret key,
without a timestamp; Paystack documents this as a transitional format.

## Receiver behaviour

- Keep the existing `PAYSTACK_MODE=disabled` default. Do not create or invent
  credentials, send a test webhook, or switch payment flags as part of this patch.
- If `PAYSTACK_WEBHOOK_SECRET` is **unset**, accept only the existing legacy
  `x-paystack-signature` with `PAYSTACK_SECRET_KEY` and raw-body constant-time
  validation. This retains compatibility for accounts without a signing secret.
- Once the dedicated `PAYSTACK_WEBHOOK_SECRET` is **set**, require the new
  `Paystack-Signature` header. Validate a single integer timestamp within five
  minutes of the server clock, one or more bounded `whk_` signature entries and
  the exact raw-body HMAC using the whole `whsec_` value. An absent, expired,
  malformed or mismatched new signature is rejected with `401`, even when an
  otherwise valid legacy header accompanies it. Do not silently downgrade.
- Both Paystack modes use separate credentials; a configured `whsec_` secret is
  not permitted when the provider itself is disabled. New and old signatures
  authorize only ingestion, not a payment outcome. The existing reference,
  amount, currency, provider-truth, deduplication and financial-state checks
  remain unchanged.

## Staged migration checklist (future, owner-controlled)

1. In an approved **test** environment, configure a Paystack test signing
   secret in Paystack's dashboard. Confirm test events actually carry the new
   header; the environment must have a real `sk_test_` API key and an independent
   `whsec_` secret. Keep `PAYSTACK_MODE=test`; never use live credentials for QA.
2. Deploy this backend with `PAYSTACK_WEBHOOK_SECRET` stored in its secret manager
   alongside the existing test API key. Confirm provider-delivered `ping` and
   `charge.success` events, including the 200 acknowledgement, duplicate replay,
   timestamp rejection and audited reconciliation in an isolated test account.
   The server clock must be synchronized. Do not treat a synthetically signed
   HTTP fixture as provider acceptance.
3. For rotation, install the replacement `whsec_` secret during Paystack's
   overlap window; Paystack can sign events with both keys. Exercise an actual
   resend and verify no event is lost before removing the old secret.
4. Consider live mode only after separate finance/operator approval, exact
   signed-commit CI, matching backend/database migration and recovery gates,
   provider test evidence, and the existing four-eyes payment release controls.
   There is **no** automatic live-mode activation here.

Bounded source checks cover tampering, missing/malformed/duplicate timestamps,
both replay-window edges, multiple signatures, legacy preservation and rejection
of a valid legacy signature when the new mode is configured. The existing
database-gated signed dispute event test now uses the new header; final execution
still requires an isolated PostgreSQL test database and CI.
