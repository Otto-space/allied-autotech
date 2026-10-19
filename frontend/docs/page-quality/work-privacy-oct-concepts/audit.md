# Privacy review audit, gate 78

Route `/admin/privacy` is one global capability-protected queue with inline request
review and account retention holds. There is no separate privacy detail route.
Customer intake/history passed its own gate and must retain its existing behavior.
Staff, Admin and Super Admin all need active PRIVACY_REVIEW; role alone is insufficient.

The current generic stacked page duplicates framing, reduces dates to calendar days,
mixes request/customer response/hold controls without a compact hierarchy, and loses
paging/selection on reload. Review fields remount after reviewedAt changes. It ignores
background refresh errors and stores unknown-write locks only in component memory.
No fresh actor/request/hold read coordinates the three independent mutation forms.

The API currently offers only cursor/limit for the queue and no direct request read.
Add compatible staff-only status/kind/exact-account filters so review remains usable
at scale; do not invent account names/contact projections. Use current selected-page
preflight and stop safely when the selected request moves off that page. Review uses
expectedReviewedAt and must preserve millisecond precision. Holds are honestly the
latest100, including released entries; approval checks all active holds and unresolved
disputes on the server. No deletion/anonymization executor exists or is authorized.

Backend inspection finds hold release writes an UPDATE audit even when no active
row changes. Reject a competing/already-released outcome without a second audit.
Serialize account retention creation/release with privacy approval using the existing
privacy account lock, retaining request row/CAS checks. Preserve capability/MFA and
atomic mutations/audits. Forward-compatible query/receipt changes should need no
schema, migration, grant or existing-data rewrite.

Reuse accepted Quicksand workshop shell, query/cursor utilities, review/form drafts,
current privacy forms and retention semantics. One parent guard should coordinate
review/create/release, recheck actor/request/account/hold, validate exact outcomes,
keep minimal pending locks through reload and reconcile by explicit reads without
resending or claiming an original-request receipt. Denial clears protected records;
temporary failures retain labelled facts with changes blocked. Stable forms require
explicit field reload when their review timestamp changes.
