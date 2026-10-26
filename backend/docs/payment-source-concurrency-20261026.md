# Payment source state and expiry — 26 October 2026

## Confirmed race

An isolated PostgreSQL test paused a payment-intent transaction after it read a payable order. A second transaction moved the deadline past and expired the order. The original transaction then created a `REQUIRES_PAYMENT` intent for that cancelled order. A later checkout attempt would reject the source, but the stored intent and customer-facing payment state were already misleading. No production order or payment was changed during reproduction.

## Correction

Payment source resolution now locks the owned Order, Invoice or VehicleTransaction row before reading its status, amount and deadline. The lock is held through intent creation or attempt preparation. It uses the same source-row boundary as cancellation/expiry, so a cancellation that commits first is read as cancelled; a payment mutation that holds the lock first completes before cancellation can commit. Ownership is part of each locking query. Existing target advisory locks, payment locks, provider verification, idempotency, finance policy and settled-capture accounting remain in place. There is no schema, migration, launch-mode or financial-policy change.

The focused concurrent-order test covers intent creation, online checkout preparation and manual evidence submission: cancellation holds the real row lock, each payment path waits, then rejects the cancelled source without creating a new intent or attempt. The earlier read-before-cancellation schedule reproduced the stale-intent defect before the source-lock change. The vehicle-expiry fixture also contained an outdated expectation that a full-payment intent would fail even though the isolated synthetic agreement was approved; that unrelated setup assertion was removed, leaving the actual expiry and in-flight-payment checks intact.

Source review after rollout confirmed the invoice transition path calls `lockInvoice` and the vehicle-sale transition/expiry paths call `lockTransaction`, each using a `FOR UPDATE` lock on the same source row before changing status. A subsequent isolated database cycle held and committed a valid invoice-void or vehicle-cancellation source-row update while each of the three payment entry paths waited. All six new races rejected the changed source with no new intent or attempt. The test uses the real PostgreSQL row locks and constraints but models the source transition directly; a separate actual operator-service transition race remains unverified.

## Verification and remaining limits

A fresh localhost-only `_test` PostgreSQL 17 database replayed all 71 migrations and Prisma reported no schema difference. Eight integration files passed 48 tests covering order and vehicle expiry, booking settlement/expiry, online initialization, attempt exclusivity, source and target concurrency. The isolated target passed `db:check`; backend typecheck, lint and format checks passed. All test customers, staff, policies and payments were synthetic. Concurrent invoice voiding and vehicle release against all payment entry paths, provider sandbox reconciliation, real authenticated roles and production settlement remain separate acceptance work.

The frontend requires no runtime change.

The exact merged candidate `1f2e8c89` was rechecked after incorporating the newer deployed source `8c11c3a0`. A second fresh localhost-only `_test` PostgreSQL 17 target replayed all 71 migrations with no schema difference; `db:check`, all 48 focused integration cases, backend typecheck and lint passed. The disposable test container was removed, all 14 existing Docker volumes were retained, and C: had 28.14 GiB free at postflight. This remains local candidate evidence, not a production deployment or live-provider acceptance.

## Backend production release

Runtime commit `2033b1596f9a9c28c6911037c381d10fc74aea60` was pushed on `fix/payment-expiry-race-20261026`. Four images were built from that clean source and passed all nine image security/runtime checks. The final source also passed format, OpenAPI (365 paths), route coverage (425 documented operations), scripts/configuration typechecks and the secret guard (3,145 non-ignored files). The first OpenAPI check ran without the required test environment and failed configuration validation; with scoped synthetic test values, the generated artifacts required no tracked change and the check passed. No frontend image or Vercel deployment was changed.

DigitalOcean existing-app proposal accepted a spec derived from the active app, with only the four image digests changed. The app's read-only `PRE_DEPLOY` database checker and all 16 deployment steps succeeded. Deployment `3cb61958-e460-494b-ae29-1ce826ac22b9` became ACTIVE with no in-progress rollout. Its API, identity-worker, general-worker and migrate digests match the private release manifest exactly. No schema migration, application-data write, grant change or provider transaction was performed by this release.

Direct API liveness and readiness, plus readiness through `alliedautotech.com`, returned 200. Anonymous session and customer payment reads returned 401. Public Home, Parts and Help returned 200; `/shop` returned 308 to `/parts`; `www` redirected to the apex. Eight managed encrypted backups were listed, latest 2026-10-26 05:22:11 UTC. The existing separate 2026-10-25 18:03:19 UTC logical restore rehearsal and retention/PITR evidence were reused; no new managed PITR exercise ran.

The GitHub integration rejected PR creation with 403, so no PR-triggered locked CI is claimed for this commit. Local exact-source checks and hosted rollout checks above are the release evidence. Paystack/Monnify remain disabled in browse-and-enquiries mode. Provider sandbox reconciliation, authenticated production role journeys, device/browser push and real settlement remain open. At postflight C: had 27.6 GiB free; all 14 pre-existing Docker volumes and current/rollback images were retained.

## Post-release source-transition coverage

The test-only follow-up in `payment-target-concurrency.test.ts` covers invoice and vehicle sources across intent creation, online initialization and manual evidence. Its first vehicle fixture attempts failed the real `aat_vehicle_transaction_status_timestamps` check because a cancellation requires both `cancelledAt` and `cancellationReason`; the fixture was corrected without changing application code or schema. On the fresh isolated `_test` target, all 71 migrations replayed with no Prisma difference, the three adjacent integration files passed 38 tests, `db:check`, backend typecheck, targeted lint and format passed. No provider or production financial write was used. This follow-up does not require another runtime deployment.
