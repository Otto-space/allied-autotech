# Configurable appointment reminders - 9 November 2026

Source batch: codex/reminder-schedule-20261109. Not published acceptance.

Branch capacity approval supports up to three distinct whole-minute offsets from
1 to 10,080 minutes; empty means none. An absent setting uses delegated defaults
of 1,440, 120 and 30 minutes. These are implementation defaults, not verbatim owner
choices or a policy published by an invented operator. Existing verified Super
Admin/MFA approval, evidence, effective date, version and recovery controls apply.

Scheduling reads the appointment's saved capacity-policy version. A new policy
does not rewrite earlier jobs. New confirmations and approved schedule/timing
changes create only future applicable reminders, with stable per-version identity
and database deduplication. Short-notice bookings skip missed send times. Existing
cancellation/rescheduling transactions, delivery-time checks and appointment expiry
remain. Legacy jobs/kinds are retained without backfill. Preferences and channel
settings are unchanged. No reminder records arrival, absence, cancellation or fees.

Migration 20261109203000_configurable_booking_reminders adds three enum values
only. Notices use a general title and absolute appointment time. Unscoped public
capabilities identify appointment-policy timing instead of a universal 60 minutes;
the legacy scalar is null. Synthetic OpenAPI examples preserve that null.

Public service-request v31 keeps its public gate and twelve steps. New
booking-reminders v1 is owner-only with an allowlisted destination. Existing staff
guidance remains v15. No tutorial grants permissions and no learning/delivery flag
is enabled.

## Actual verification

- Empty isolated replay of all 102 migrations and db:check pass.
  A final Git-filtered canonical replay is still required before release.
- All 135 booking/resource/rescheduling/reminder/Customer Care integration cases
  and 11 learning API cases pass on isolated PostgreSQL with a restricted non-owner
  runtime. Its login is disabled. Memory-only providers; no production writes.
- Initial integration: 132 pass, three fail. Two new synthetic policies lacked
  required sourceQuestion metadata; an existing concurrency assertion still
  expected one reminder. Corrected without weakening constraints or deduplication.
- Final combined scheduling, Help, retrieval and OpenAPI units: 45 pass across six
  files, including owner-only negative coverage. Earlier 37/23-case runs overlap
  this result and are not summed. OpenAPI validation passes for 452 paths.
- Five frontend capacity receipt/recovery units, scoped frontend lint and both
  backend/frontend types pass. Frontend types first exhausted a 512 MiB heap, then
  passed at 1,024 MiB after a successful 1 GiB disk-growth preflight.
- New 320/768/1440 review, validation, keyboard/focus, custom-save, explicit-none,
  overflow, Axe and safe-capture cases await execution. No new before/after image,
  real-role or physical-device pass is claimed.

Private receipts: TEMP/aat-attendance-20261104/reminder-schedule-1794256024363-*
(initial replay/failures) and reminder-schedule-recheck-1794256359919-* (successful
final database run).

## Release and remaining acceptance

Canonical d05113f6 verification subsequently passes: 102-migration replay/db:check,
14 reminder cases first, then 121 other booking cases and 11 learning API cases.
The initial canonical domain run had two failures because lifecycle fixtures left
global due jobs before the reminder suite; matching CI's separate first invocation
fixes the harness without clearing data or changing assertions. The earlier
worktree/Git-filtered line-ending mismatch was not treated as canonical proof.
No applied migration was rewritten. A subsequent Nigeria-time message change adds
a UTC/date-boundary case; final-source verification remains pending.

Final source 31012924 passes canonical 102-migration replay/db:check and all 15
reminder/concurrency cases, including the Nigeria date rollover. Its backend and
secret CI gates pass. Frontend CI passes 1,526 units (12 existing skips), nine
WebKit diagnostics, 21 media preflights and 787 of 788 rendered cases. The sole
failure is the 1440px reminder case: the sidebar expands during its full-page
capture, leaving no Expand sidebar control. The capture assertion and actual
expand action remain required. Saved-items removal and Escape focus cases pass
in Chromium, Firefox and WebKit. These are synthetic workflows, not live roles.

A protected populated restore of the retained production snapshot passes forward
migration from 100 to 102, db:check and original-column/row/history preservation.
Receipt: TEMP/aat-attendance-20261104/release-reminder-schedule-31012924-20261109/
populated-restore-1794259516961-verified.json. The isolated restored database holds
protected snapshot data; it is not a fixture test database. Renew the production
backup and managed backup/PITR checks before any production migration.

Recovery verification found that the unmodified 9c219bc8 API throws Prisma P2023
when a booking projection reads NOTICE_2 from a synthetic database. A compatible
worker alone is therefore insufficient. Before creating new NOTICE jobs, deploy
and verify both a schema-compatible API and the compatible general worker; retain
that compatible API, worker and migrator for recovery. An older API must not be
selected just because scalar schema probes pass. A packaged compatibility bridge
and its real enum-reading proof remain required; the 13 passing composition-helper
fixture cases do not establish runtime compatibility. No old all-component rollback
or reversal of enum/data history is authorised. Exact merged-source CI, packaged
images and full release/recovery gates remain outstanding.

Packaging remains disk-blocked. Actual operational email, optional push delivery,
calendar-app/device acceptance and the complete original audit remain open.
No new owner answer is needed for these delegated configurable timings.
