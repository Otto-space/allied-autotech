# Booking alternative proposal rollout

Migration 20261030200000_booking_alternative_proposal only adds three nullable
columns and an all-or-none check. It neither rewrites existing appointment times
nor modifies financial rows. Preserve the migration bytes after replay/commit.

The proposal is tied to the resulting booking version. Any intervening mutation
makes an old proposal ineligible for a response. Staff require current branch scope,
verified MFA and BOOKING_CONFIRM. Customer response requires ownership and exact
version. Acceptance clears assignment/slot and returns REQUESTED, increments the
schedule version and cancels prior reminders; staff must review resources again.
No fee, payment change, automatic confirmation or customer-reschedule debit.

Before application rollout, complete UI/API acceptance and backup safeguards from
database-safety.md, verify encrypted off-device backups and isolated restore, then
use the reviewed db:migrate runner with its backup/history checks. Do not run db
push or reset. Stop on drift or wrong target. Rollback is disabling proposal writes
and retaining columns/history; never drop proposal data or restore over live data.
Current evidence is isolated test replay only, not authorisation for production.
