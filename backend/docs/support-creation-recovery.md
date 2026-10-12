# Customer support creation recovery

Customer enquiries and complaints retain their original request for explicit recovery after an interrupted submission. Recovery returns the existing owned record when the original request committed, or creates it once when it did not. This document covers creation only; durable customer reply recovery is described in [support reply recovery](support-reply-recovery.md), while anonymous contact submissions remain separate.

## Contract

`POST /customers/support/enquiries` and `POST /customers/support/complaints` require `Idempotency-Key: support-create-v1.<13-digit Unix milliseconds>.<lowercase UUID v4>`. Authentication, customer role, CSRF, strict bodies, rate limits and private/no-store responses apply on every attempt. Initial creation preserves source ownership, active branch/source checks, branch inheritance and complaint policy/deadline assignment.

Keys are scoped by authenticated user and operation. Normalized, sorted request fields are hashed; a changed body returns 409 `IDEMPOTENCY_CONFLICT`. Reusing a key from a different customer namespace cannot disclose or replay the original customer's result. A receipt pointing to a missing or foreign-owned resource fails closed. Missing or malformed keys return 422.

Success is HTTP 201 with the existing safe record projection plus `replayed`. Recovery returns the same record ID and its current status, assignment and resolution; it does not reopen closed records, repeat source/branch eligibility checks, reset complaint deadlines or create another audit. Contact fields, internal messages and receipt hashes are excluded.

The recovery window is 24 hours from the key timestamp. Expired keys and timestamps more than one minute in the future return 409 `IDEMPOTENCY_EXPIRED`. Expiry is checked against the database clock after acquiring the transaction lock, including when cleanup has already removed the receipt. Clients must not replace an expired key automatically.

## Persistence and browser behavior

The existing `IdempotencyRecord` stores the actor, operation scope, SHA-256 key/body hashes, resource ID, completion status and expiry. The record, creation audit, complaint policy work and receipt commit in one serializable transaction. Same-key calls serialize through a transaction advisory lock; existing bounded transaction retry handles database-aborted serialization/deadlock failures. No migration is required. Creation currently does not enqueue a notification; this change claims no provider delivery.

The frontend stores the validated original key/body in account- and operation-scoped session storage before sending. After a lost response or reload, new creation stays disabled until the customer explicitly reviews and confirms recovery. Recovery sends the retained request, regardless of current form edits, and rechecks the current customer session. Navigation, reconnect and refresh do not automatically POST. Success clears the recovery marker and submitted form draft, then opens the owned conversation.

Session invalidation redacts private recovery contents while retaining an uncertainty marker. Corrupt, legacy, expired and unavailable retained state cannot generate an automatic retry; the existing owned-history reconciliation remains available. Browser storage failure prevents a new submission without a recoverable original request. The retained request is tab-session state, not cross-device or indefinite storage.

## Release

Deploy the matching API and frontend together, with the regenerated OpenAPI types. Older customer clients that omit the required key must reload. Database migrations remain at the existing count; this feature uses the existing receipt table. Reservations, payment providers, object storage, marketing and destructive privacy policy gates are unchanged. Deployed acceptance and provider delivery remain separate from local verification.

## Local verification

- 36 unique backend API/database cases passed across the focused run and corrected fixture reruns: 20 creation-recovery cases plus 16 existing support/worker/boundary cases. Coverage includes all six enquiry types and four complaint source choices; normalized replay after closure and inactive branches; preservation of complaint deadline snapshots; concurrent duplicates; changed bodies and corrupt foreign receipt references; audit rollback; key expiry before/after cleanup; and authentication, CSRF and strict payload boundaries.
- 458 frontend unit tests passed, including six recovery-storage cases for original contents, account/operation isolation, invalid sources, expiry, storage denial and session redaction. Frontend type checking, full lint, changed-file formatting and production build passed. Backend lint, type checking, build, formatting and secret scanning passed; OpenAPI validation covered 267 paths and route verification covered 316 operations.
- Ten new installed-Edge browser cases passed on a production standalone build at `http://localhost:3000`: six controlled-network/account scenarios and four against the real loopback API and `allied_preferences_20261013_test`. The real cases cover both operations with committed response loss and interruption before commit. The final isolated customer had exactly two enquiries, two complaints, four creation audits and four receipts.
- The broader customer-care/shared-support regression added 84 unique passing cases (82 in the initial run plus two updated account-change expectations in the focused rerun), for 94 unique browser cases in total. Public contact, all source choices, customer replies, staff visibility/status/assignment, role changes, stale reads, rate limits, draft restoration, legacy reconciliation and responsive/accessibility coverage passed. Account/role changes now close the dialog and require session verification with zero POSTs; the older tests expected the dialog to remain open.
- Recovery confirmation passed WCAG 2 A/AA and 2.1 AA checks at 1440 and 390 pixels for both operations, without horizontal overflow or page errors. Desktop enquiry and mobile complaint screenshots were inspected. Browser plugin not available; the repository Playwright setup with installed Edge was used. Core changed frontend files matched the isolated build source.

Evidence artifacts are in the local temporary directory: `allied-support-create-regression.json`, `allied-support-create-expiry.json`, `allied-support-create-frontend-unit.json`, and `allied-support-{enquiries,complaints}-recovery-{1440,390}.png`. Browser commands are the repository Playwright runs for `support-creation-replay.spec.ts` and `support-creation-real.spec.ts`; the guarded API helper is `tests/helpers/support-creation-api-server.ts`. Synthetic sessions remain outside the repository. No application database migration or production provider activation was performed.
