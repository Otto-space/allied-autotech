# Payment source state and expiry — 26 October 2026

## Confirmed race

An isolated PostgreSQL test paused a payment-intent transaction after it read a payable order. A second transaction moved the deadline past and expired the order. The original transaction then created a `REQUIRES_PAYMENT` intent for that cancelled order. A later checkout attempt would reject the source, but the stored intent and customer-facing payment state were already misleading. No production order or payment was changed during reproduction.

## Correction

Payment source resolution now locks the owned Order, Invoice or VehicleTransaction row before reading its status, amount and deadline. The lock is held through intent creation or attempt preparation. It uses the same source-row boundary as cancellation/expiry, so a cancellation that commits first is read as cancelled; a payment mutation that holds the lock first completes before cancellation can commit. Ownership is part of each locking query. Existing target advisory locks, payment locks, provider verification, idempotency, finance policy and settled-capture accounting remain in place. There is no schema, migration, launch-mode or financial-policy change.

The focused concurrent-order test covers intent creation, online checkout preparation and manual evidence submission: cancellation holds the real row lock, each payment path waits, then rejects the cancelled source without creating a new intent or attempt. The earlier read-before-cancellation schedule reproduced the stale-intent defect before the source-lock change. The vehicle-expiry fixture also contained an outdated expectation that a full-payment intent would fail even though the isolated synthetic agreement was approved; that unrelated setup assertion was removed, leaving the actual expiry and in-flight-payment checks intact.

## Verification and remaining limits

A fresh localhost-only `_test` PostgreSQL 17 database replayed all 71 migrations and Prisma reported no schema difference. Eight integration files passed 48 tests covering order and vehicle expiry, booking settlement/expiry, online initialization, attempt exclusivity, source and target concurrency. The isolated target passed `db:check`; backend typecheck, lint and format checks passed. All test customers, staff, policies and payments were synthetic. Concurrent invoice voiding and vehicle release against all payment entry paths, provider sandbox reconciliation, real authenticated roles and production settlement remain separate acceptance work.

This change is a source candidate until its exact backend release and live readiness are verified. The frontend requires no runtime change.
