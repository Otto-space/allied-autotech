# Booking reminder claim ownership

Updated 11 October 2026.

## Behavior

`BookingReminderWorker` returns the attempt number with each claim. Before processing an item, it locks the reminder row and checks that the row is still `PROCESSING` with that same attempt number. A superseded item creates no notification and contributes neither a sent nor a cancellation count. Notification enqueue and the `SENT` transition remain in the same database transaction.

Failure recording uses the claimed attempt number in its conditional update. A delayed failure cannot replace another worker's lease, failure schedule or completed result. Backoff derives from the owned attempt rather than a fresh read of a potentially newer attempt.

The existing eight-attempt retry budget now applies to crash recovery as well as caught failures. Exhausted pending/failed rows and exhausted processing rows whose ten-minute lease has expired become `DEAD_LETTER` with `REMINDER_RETRY_EXHAUSTED`. A fresh final lease remains eligible to complete. A legacy row at the database maximum of twenty attempts no longer makes the batch claim violate its check constraint and abort other reminders.

Booking confirmation and schedule-version checks, signed booking actions, notification deduplication, transactional category, consent handling and delivery-provider configuration retain their existing behavior. `SENT` means durably enqueued, not delivered to the recipient.

## Verification

A new isolated `allied_reminder_claim_20261009_test` database replayed all 51 migrations. Before the repair, six of seven initial cases failed against real PostgreSQL, recorded in `%TEMP%/allied-reminder-before.json`. The failures reproduced stale enqueue/cancellation, stale failure overwrites, a ninth attempt after crash recovery, and a legacy exhausted row aborting a valid batch. The transaction-rollback control passed before and after the repair.

The final eight concurrency cases cover those failures plus successful and failed final owned attempts. They delay entry to actual Prisma transactions to coordinate two worker executions; the SQL claims, row locks, notification writes, rollback and completion operations execute against PostgreSQL.

The combined regression run passed **65 tests in seven files**, with no skips:

- `booking-reminder-concurrency.test.ts`: 8
- `database-time-boundaries.test.ts`: 25, including UTC, Lagos and New York scheduling
- `owner-booking-policy.test.ts`: 7
- `booking-response.test.ts`: 4
- `phase9-support-workers-flow.test.ts`: 8
- `phase9-support-notification-security.test.ts`: 6
- `phase9-boundaries.test.ts`: 7

The report is `%TEMP%/allied-reminder-regression.json`. Backend typechecking, lint, build, affected TypeScript formatting and `git diff --check` passed. The secret guard passed for 1,646 non-ignored files. Email, SMS and payment providers remained disabled. No live messages were sent.

## Rollout and remaining work

There is no schema or public API change for this repair. Drain and restart every general worker to prevent older code from continuing to write without ownership checks. Deployment has not been performed. The earlier UTC migration/pool changes have their own [rollout requirements](database-time.md).

Exhausted reminders are retained for investigation; the change does not reset attempts or automatically resend old reminders. Operator recovery for historical failed/stranded work remains separate audit work. The subsequent [payment-webhook ownership repair](webhook-retry-ownership.md) covers that worker and its financial transactions. No claim of exactly-once remote delivery is made.
