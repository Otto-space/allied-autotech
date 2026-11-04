# Arrival and attendance checkpoint — 4 November 2026

Source implementation; publication and real-role acceptance remain pending.
Booking-confirmation v12, assigned-findings v4 and public service-request v29
explain factual arrival/wait/left history, staff-verified absence, no automatic
penalty, existing responsibility limits and uncertain-response recovery.
Existing eligibility gates are retained: booking confirmation, assigned job
updates, and public customer guidance respectively. Learning grants no authority.
No publication, booking, payment or notification-delivery flag was enabled.

The delegated 15-minute grace is identified as a default, with an existing
owner-reviewed branch policy override. A timer or RSVP does not establish absence.
Active work and previous physical arrival prevent marking the appointment missed.
Waiting does not change the scheduled time or confer queue priority.

Verification: focused content assertions accompany existing reschedule guidance
tests. See the existing site completion tracker for actual execution results and
remaining rendered, real-role, notification and release acceptance requirements.

Release compatibility: migration 98 prevents a raw transition to NO_SHOW without
the matching verified-absence history. The prior API's raw status-update path is
therefore not operationally compatible with that transition after migration,
even if schema-only startup probes pass. Publication requires a reviewed writer
transition and compatible recovery API; no production migration was applied by
this attendance batch. Retain current production and recovery resources.

Integration preserves master recorded-work guidance and the current customer and staff calendar instructions. The combined article versions advance rather than overwriting the independently prepared versions.

Retrieval acceptance: customer service guidance remains within the existing 12-step and 8,000-character passage limits. The existing five-audience retrieval coverage is retained; no restricted catalogue is widened to make content discoverable.
