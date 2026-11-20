# Arrival and attendance checkpoint — 4 November 2026

Source implementation; publication and real-role acceptance remain pending.
Booking-confirmation v14, assigned-findings v5 and public service-request v29
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

9 November reconciliation: full attendance guidance supersedes the transitional
unavailable wording at v13/v5. Permission gates and the complete recovery behavior
remain; combined-source checks must pass before publication.

9 November combined work-review integration: booking-confirmation v14 preserves
both physical attendance and current remaining-work review guidance. The combined
candidate has 99 migrations. New source/client/contracts and both workflows need
fresh verification; earlier 237 attendance cases do not certify this merge.

9 November D11 source checkpoint: booking-confirmation v15 explains checked dates
and available times, qualified technicians and actual resources, repeated checks at
proposal/acceptance/approval, unchanged original appointment until approval and a
same-day/same-branch continuation link to actual presence. A departed or later-day
customer needs a fresh observed arrival. No tutorial grants permission, no deadline
or fee is invented and no feature flag is activated. Retrieval/eligibility units pass;
production operational acceptance and the guarded schema-100 release remain pending.
