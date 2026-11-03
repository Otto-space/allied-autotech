# Owner resource editor source checkpoint

The owner resource editor now exists at /admin/booking-resources, with real-record
lookup, explicit assessments/qualifications, physical identities, working and
unavailable periods, approval review and uncertain-result recovery. It does not grant
work duties or release existing booking allocations. Immediate application uses the
fresh server clock; edits preserve recorded exception precision.

Booking-confirmation article v10 describes the owner workflow boundary. New
workshop-resource-plan v1 is owner-gated and deliberately draft pending separate
publication. Eligibility tests cover verified owner versus other roles; existing
semantic targets and production feature flags remain unchanged. The screen provides
its own instructions; reading guidance cannot approve a plan.

Frontend 70-unit and backend 22-unit evidence passes. The completion tracker carries
the final rendered receipt, failed attempts, screenshot locations and actual-role/
provider limitations. Parent native lookup/policy evidence is distinct from browser
fixtures. No operational records, financial approvals or publication are fabricated.

The earlier foundation checkpoint below is historical and does not override this
implementation update.

# Workshop resource authoring checkpoint

Source-only D06/D07 foundation; no tutorial publication or new permission.

The owner-only resource options endpoint supplies minimal real service/staff names
and eligibility. Search/pagination cannot grant job duties. Exact references can
remain readable as unavailable so an editor can explain stale selections. New
resource-policy client validation/recovery prepares immutable review, without
persisting private approval bodies or schedules in browser storage.

The authoring route and user-facing walkthrough are not yet implemented. Existing
restricted booking-confirmation v9 and public service-request v22 remain current;
no semantic guide target, eligibility rule or production flag changed in this
batch. When the complete editor is added, version the appropriate owner workflow,
check eligibility/targets and verify actual steps before separate publication.
Do not describe a plan as actual approved capacity merely because a picker works.

Native evidence: 18/18 lookup/policy cases on a fresh isolated 95-migration tmpfs
database, with restricted runtime and owned cleanup. Frontend contract/API evidence:
43/43 units, including session invalidation redaction and isolation from capacity
recovery. Rendered editor, provider and real-role acceptance remain outstanding.
See backend/docs/site-completion-tracker.md for the exact log and failed attempts.
