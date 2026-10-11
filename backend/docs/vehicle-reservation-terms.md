# Vehicle reservation agreements

Updated 11 October 2026. BG-11 backend implementation; approved business content, frontend review/acceptance and deployment remain outstanding.

## Contract and authority

The existing MFA- and CSRF-protected `POST /api/v1/admin/policies` accepts `kind: VEHICLE_RESERVATION_TERMS`. Only Super Admin may publish this kind, following the existing non-financial policy authority. The existing `GET /api/v1/admin/policies?key=vehicle_reservation_terms` supplies bounded immutable publication history and the latest revision for optimistic concurrency. No customer, Staff or Admin may approve these terms.

Publication retains the existing required `expectedVersion`, `effectiveAt`, `source` and `approvalEvidence`. Enabled settings contain `enabled: true`, a plain-text `title` (1–200 characters) and plain-text `body` (1–50,000 characters). Disabled settings contain `enabled: false` and `reason` (1–1,000 characters), withdrawing availability without changing old documents. Control characters other than tabs/newlines are rejected. The request remains subject to the configured request-body byte limit. Publication creates a new immutable policy row; it does not rewrite or delete any earlier version. A future effective time does not authorize acceptance early. The applicable policy is the latest effective time, with revision as tie-breaker, matching existing policy semantics; scheduled future publications still take effect on their recorded dates.

`GET /api/v1/customers/vehicle-transactions/{transactionId}/reservation-terms` requires ownership and returns `private, no-store`. Missing or foreign purchases return 404. Its data is:

- `current`: the applicable enabled approved document, or null when none is available.
- `accepted`: the exact previously accepted document and server acceptance timestamp, or null.
- `legacyAcceptance`: true for historical acceptance metadata without a linked document. No historical wording or signer is invented.

Documents expose `version` (immutable policy UUID), numeric `revision`, `title`, plain-text `body`, `contentSha256` (SHA-256 of the UTF-8 body), and `effectiveAt`. Internal approval evidence and approver details are excluded. Render body text as text, never executable HTML. Availability of a document is informational; the reservation mutation remains authoritative.

The existing reserve request shape remains `{ expectedVersion, termsVersion, termsAccepted: true }` with a mandatory `Idempotency-Key`. New requests submit the document's UUID as `termsVersion`. Arbitrary labels such as `v1`, stale/withdrawn/unapproved versions and future versions fail with 409 before any listing hold commits. Missing or false acceptance fails validation. The service also requires true acceptance when called directly.

Matching retained idempotency receipts are resolved before current-term validation, so a lost-response retry remains usable after replacement or withdrawal. Replays recheck ownership; changed input conflicts. Retention remains the existing idempotency retention, not an indefinite replay promise.

## Persistence and concurrency

Migration `20261011180000_vehicle_reservation_terms` adds nullable policy and accepting-user foreign keys to `VehicleTransaction`, with indexes. Existing records retain their original metadata and null links. New acceptances link the immutable policy, actual customer user and purchase, retaining the existing version/timestamp fields. The reservation audit includes document version and body hash without copying agreement text or private approval evidence.

Publication and acceptance use the same transaction advisory lock. Reservation then keeps the existing listing-before-sale lock order, optimistic version check, one-buyer uniqueness constraint, atomic history and idempotency receipt. The acceptance timestamp is captured after acquiring the policy lock and is used consistently when selecting and recording the applicable document, including scheduled-policy boundaries.

PostgreSQL validates approved owner provenance on publication, checks new acceptance against the applicable document and customer, and protects accepted version, timestamp, policy, accepting user, customer and listing from later edits. Existing accepted records receive the same immutability protection but are not retroactively linked to invented documents. Approval documents already have an append-only database trigger.

Publishing agreement text does not approve the separate draft vehicle deposit/paid-hold policy, enable payment providers or create a payment. Existing money and owner-policy gates remain authoritative.

## Verification

All 52 migrations replayed into the new isolated `allied_vehicle_terms_20261012_test` database. The additive migration also applied to `allied_refund_observation_20261011_test`: all four historical synthetic acceptance records were unchanged, both new links remained null, and an ordinary version update still succeeded (rolled back afterward). The service read returned `legacyAcceptance: true` without invented content, and an absent agreement produced 409. No application database was migrated.

The 12 new real PostgreSQL/HTTP cases cover withdrawal, current content and projection, immutable acceptance, forged/superseded/future/draft versions, missing acceptance, stale transaction versions, foreign access, publishing role/MFA/CSRF checks, idempotent replay and publication concurrency. The concurrency test observes an actual blocked advisory lock before committing withdrawal, then confirms the waiting reservation creates no hold. Existing Phase 7 tests exercise two customers competing for one listing using a synthetic approved document.

Initial runs exposed test-fixture field mistakes, an obsolete operation-count assertion and interference from two concurrent test runs sharing publication state. Fixtures/assertions were corrected and the tests rerun sequentially; these were not production security failures. The focused agreement/contract/owner-policy follow-up passed 21 tests. The final combined acceptance passed **59 tests in ten files, without skips**, recorded in `%TEMP%/allied-reservation-terms-acceptance.json`. It includes agreement, vehicle-sale, commerce, payment-target concurrency, settlement/expiry, private-storage, API-boundary, OpenAPI and owner-money-policy cases.

Prisma formatting, validation, generation and isolated migration status passed. Backend typecheck, lint, build, affected-file formatting and secret scanning passed. OpenAPI validates 266 paths; route coverage matches 315 operations plus four infrastructure routes. The OpenAPI artifact, endpoint handbook and frontend types were regenerated; frontend `tsc --noEmit` passed. This is backend and contract acceptance, not browser acceptance of the new reservation review.

## Rollout and remaining acceptance

Drain older API processes, apply the additive migration, deploy the regenerated Prisma client and API/worker code, then restart. Older reservation writers do not supply the required evidence and will be rejected after migration. Migration and deployment have not been performed on an application environment.

No business agreement was published. Synthetic test wording is confined to explicitly guarded disposable test fixtures and must never be seeded into production. Obtain approved wording, effective date and provenance from the owner; publish through the existing Super Admin policy workflow.

Frontend work remains: an owner publication/review interface and a separate customer agreement review with explicit acceptance, fresh version validation and original-key recovery. Browser acceptance must prove cancelling creates no hold, confirming creates one hold, stale terms require renewed review, and requesting payment alone never accepts terms. Preserve current customer-care guidance until that workflow is accepted. Real provider/session/deployment checks remain under REL-03.
