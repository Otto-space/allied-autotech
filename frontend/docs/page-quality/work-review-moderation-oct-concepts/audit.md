# Review moderation audit — gate 79

Route `/admin/reviews` is an Admin/Super Admin global moderation queue, with verified
MFA. Ordinary Staff and Customers cannot read or moderate. No additional capability
grant is required; do not invent one. Public/customer review workflows remain separate.

Current page weaknesses: generic stacked cards, date-only timestamps, hidden source
references, ungrouped controls, in-memory filters/cursors, version-keyed form remounts,
unlabelled background failures and memory-only uncertainty. Existing approval/rejection
CAS, confirmation, customer-visible notes and notifications must be preserved.

The staff collection is oldest first with required/default PENDING status and optional
targetType. There is no authorized direct review read. Moderation removes a record
from its pending page; add a compatible direct read and exact review-reference filter
for current-state preflight/recovery and practical large-queue lookup. Reuse a complete
safe staff projection rather than inventing customer IDs or source names. Review target,
full references, named product/service, related order/booking/transaction facts, rating,
comment, timestamps and numeric version need deliberate presentation.

The mutation currently re-reads its response after commit. Return its safe current
receipt inside the existing transaction. Omitted approval note should explicitly save
null rather than carry an unreviewed old note. Preserve terminal states, expectedVersion,
one audit/notification intent and private response boundaries. No schema change needed.

One parent single-flight/review guard should recheck current identity and complete
review facts, validate full immutable source/content/body/version receipts, retain
minimal owner-scoped uncertainty through reload and explicitly load the current review
without replay or an original-outcome proof claim. Stable drafts need explicit reload
on external version changes. Denied reads clear protected facts; temporary failures
retain labelled content with decisions blocked. Approved/rejected entries are read-only.

Reuse workshop Quicksand shell, visible-bordered filters, query/cursor helpers,
ReviewModerationForm, MutationReview, private resource hooks and scoped drafts. Do not
redesign public ReviewCard or customer creation/source/replay flows for this gate.
