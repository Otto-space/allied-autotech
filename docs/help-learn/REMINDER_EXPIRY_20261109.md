# Delayed appointment reminders - 9 November 2026

Source candidate: `codex/reminder-expiry-20261109`, based on master `b362e9f8`.

The reminder job and notification provider boundary now check the same confirmed
status, schedule version and future appointment time. A delayed job for an elapsed
appointment cancels its reminder with `APPOINTMENT_TIME_PASSED`; a queued provider
retry becomes terminal with `STALE_BOOKING_REMINDER`. Neither operation changes
the booking, records physical attendance, releases capacity or marks absence.
An already accepted provider request can still arrive late.

Service-request v30 retains its existing public gate, twelve steps and semantic
targets. It explains current reminder eligibility, delivery limitations and unchanged
attendance/cancellation. Learning eligibility and practice permissions are unchanged;
the acceptance tests retain the public gate. No learning or delivery flag is enabled.

Local verification: five focused unit tests pass across reminder time boundaries,
unchanged short-notice scheduling and the revised learning definition. Scoped lint
and formatting pass. The handbook was regenerated from the unchanged canonical
OpenAPI document using its actual generator. New real-PostgreSQL cases cover an
elapsed delayed job, a queued provider delivery that expires, a future positive
control, terminal delivery state, deduplication and unchanged booking/attendance.
They await the existing isolated backend CI workflow; no local database run or
actual provider delivery is claimed for this candidate.

The four-image packaging preflight remains blocked by local free space. The held
product-timing frontend and its earlier evidence are retained. Configurable
24h/2h/30m reminder scheduling, actual delivery/role/device acceptance and the full
original D01-D17 audit goal remain unfinished. No schema migration is added here.
