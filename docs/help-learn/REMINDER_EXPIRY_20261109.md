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
The isolated database results below supplement the existing backend CI workflow;
actual provider delivery is not claimed for this candidate.

The four-image packaging preflight remains blocked by local free space. The held
product-timing frontend and its earlier evidence are retained. Configurable
24h/2h/30m reminder scheduling, actual delivery/role/device acceptance and the full
original D01-D17 audit goal remain unfinished. No schema migration is added here.

Further verification: a fresh isolated 101-migration replay and db:check pass.
The previous runtime reproduces both elapsed-reminder defects (two expected
failures), while its future-delivery control passes. The fixed candidate passes
11 real PostgreSQL reminder/concurrency cases and 11 learning/API cases using
a restricted runtime; its candidate workers were byte-verified restored afterward.
The synthetic runtime login is disabled. Email providers are memory-only adapters.

CI exposed stale v29 expectations, then an over-budget public booking article.
The four old version assertions were updated without removing their content/gate
checks. Repeated copy was shortened while preserving its conditions: the complete
article now uses 7,971 of the unchanged 8,000-character retrieval budget. All
27 affected Help/retrieval unit cases pass, including public/customer/staff/Admin/
owner retrieval. No passage truncation, safety check, budget or test was weakened.
Exact final-source CI and production release remain pending.

The final metadata regression passes all 12 reminder/concurrency cases against
the same isolated 101-migration database, with db:check passing. Newly enqueued
notifications expire at appointment time, so existing inbox and push expiry
controls can reject elapsed reminders. No legacy notification backfill or real
push delivery was tested. The restricted test runtime login was disabled again;
production data and delivery flags were untouched.
