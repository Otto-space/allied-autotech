# UTC database deadlines

Updated 9 October 2026. PostgreSQL `timestamp without time zone` columns in this application represent UTC instants, matching Prisma `DateTime` and JavaScript `Date`. The PostgreSQL session timezone must not reinterpret those values as local wall-clock times.

## Repair

- Application pool connections start with `timezone=UTC`, including connections used by database defaults and triggers.
- Runtime SQL explicitly uses `CURRENT_TIMESTAMP AT TIME ZONE 'UTC'` when comparing or writing these timestamp columns. This covers shared rate limits; identity, MFA and invitation cleanup; idempotency cleanup; notification/account-email and booking-reminder claims; webhook retries; refund submission/reconciliation deadlines; and derived-alert resolution.
- Migration `20261009160000_utc_refund_policy_clock` sets the existing `aat_guard_system_refund()` trigger function's local timezone to UTC. Its approved-policy, verified capture, provider, unfulfilled-order, payment-deadline, immutable provenance and manual-evidence predicates remain intact. The function cannot inherit a caller's timezone when deciding whether a payment deadline has passed.

Business opening hours and frontend display remain explicitly based on Africa/Lagos. This change standardizes stored instants and comparisons; it does not move business hours or change retention lengths, policy terms, retry budgets or provider configuration.

## Evidence

Real PostgreSQL tests reproduced sixteen clock-boundary failures and two refund timestamp failures before the repair. Earlier fixture setup failures were corrected to honor the existing MFA purpose, invitation binding, webhook verification and timestamp constraints; production constraints were not weakened.

The new tests cover UTC, Africa/Lagos and America/New_York sessions:

- Expired authentication throttles and MFA challenges are removed while future records remain.
- Expired invitations honor the existing 30-day retention boundary.
- Unexpired idempotency receipts survive cleanup.
- Shared rate-limit windows retain their count and UTC reset time across connections using different session timezones.
- Webhook retries respect future deadlines, fresh leases and retry backoff.
- Booking reminders remain pending before their schedule, preserve fresh leases and recover expired leases.
- Alert resolution timestamps represent the actual UTC instant.
- Refund submission timestamps and ten-minute recovery deadlines match UTC; repeated worker runs do not resubmit; the database guard rejects a reversal before the payment deadline in all three zones.

Twenty-five cases are in `tests/integration/database-time-boundaries.test.ts`, with three additional refund cases in `tests/integration/owner-refund-controls.test.ts`. Baseline artifacts are retained under `%TEMP%/allied-database-time-baseline-valid.json` and `%TEMP%/allied-refund-time-baseline.json`. A fresh isolated `allied_utc_release_20261009_test` database replayed all 51 migrations. Full-suite results are recorded after completion below.

## Rollout and remaining boundaries

Apply the migration and restart the API, identity worker and general worker so every pool uses the UTC connection setting. Verify `SHOW timezone` through application connections and the function's `proconfig` entry (`TimeZone=UTC`) in the target environment. The application database was not migrated by these isolated tests.

No existing timestamp is rewritten or business record deleted by the migration. Values written by older raw SQL under non-UTC sessions may already be shifted; UTC and shifted historical values cannot safely be distinguished from the value alone. Investigate affected historical leases, rate-limit windows and operational records using their provenance before any targeted repair. Broad timestamp shifts would corrupt valid data.

Provider calls in tests are injected synthetic implementations; no live payment or message is sent. Deployment acceptance, historical stranded-job recovery and worker ownership handling outside the already repaired messaging workers remain separate audit work.
