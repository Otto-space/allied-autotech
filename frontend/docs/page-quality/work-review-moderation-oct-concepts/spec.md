# Review moderation specification — gate 79

Overview > Review moderation ordered breadcrumb and a compact 30/24px heading.
Short guidance explains administrative moderation, customer-visible notes, approval
for public display and immutable decisions in this screen. Refresh moderation queue
and Refresh moderation access are explicit, with no fabricated delivery guarantees.

One grouped filter panel: Review status (Pending/Approved/Rejected, default Pending),
Review type (five supported targets, All types) and optional exact Review reference.
Apply moderation filters/Clear filters. Supported URL status/type/reference/cursor/
selected-review state survives reload/Back. Page-local counts and oldest-first copy;
Previous/First page/Next, no total-page or global rating metrics.

Complete white 12px request groups show actual title/fallback, rating out of five,
target/status, actual customer name, full review UUID, numeric version and exact Lagos
created/updated/moderated instants. Full comment, source name and references remain
readable with an honest Not recorded label for optional data. Do not invent customer
profile links/avatars, order names or photos absent from the projection. Approved/
rejected reviews show the saved customer-visible note and no mutation/reopen controls.

For Pending, Review decision expands one compact inset form with Decision and
Customer-visible moderation note (optional approval, required rejection, max 1000),
Review moderation decision. Confirm full content/source/decision/note before saving.
One parent single-flight guard, active own Admin/Super Admin identity and fresh exact
review GET protect sends. Backend CAS and terminal-state checks remain authoritative.
Stable fields survive external version changes and require explicit reload before
another reviewed decision. Validate exact immutable source/content, decision, note,
moderated timestamp and version+1. Preserve customer notification semantics without
claiming provider delivery.

Minimal actor/role/review/version pending metadata survives uncertainty and reload;
session invalidation redacts values and keeps the lock. Explicit current-review load
replaces affected drafts without resending or proving the original request outcome.
Show complete current record after recovery even if it left the pending filter. No
same-key retry without a durable backend contract. Temporary read failures retain
labelled facts read-only; denial clears private content and forms.

Quicksand 13px body/labels, 16px sections, 30/24px title, restrained red actions, ink
dashboard/sidebar, white Find a page/account strip, cool canvas, subtle rules and

> =44px bordered controls. Narrow layout uses paired wrapping labels and full-width
> review controls, no horizontal page scrolling; dialogs remain readable at 320px.
> Respect reduced motion. No charts, global totals, fake moderation/publication actions,
> bulk operations, deletion/reopening or permission administration.

Audit actual mobile/tablet/laptop/desktop before UI edits; fresh desktop/mobile Image
Gen, inspected concept corrections, production interactions, API/database concurrency,
real mutations/audits, responsive/Axe, native comparison and >=5 fidelity/copy points
complete the gate. Reuse unchanged database safety evidence; preserve data/grants and
use only the verified isolated test runtime for fixtures.

## Inspected concept corrections before UI edits

Both concepts have been viewed and retained after inspecting all four baseline
widths. Keep actual Allied logo/sidebar/red actions rather than generated branding
or blue primary buttons. Use a compact status select and page-local count; Pending(3)
and Page1 of1 are not supplied aggregate data. Only the active status's records can
appear on one page; the mobile's mixed Pending/Approved/Rejected examples are states,
not a valid combined result for the current API. Do not adopt fabricated PROD/SRV
codes, booking numbers, customer links or dates. Keep full real source UUIDs/names
and numeric versions. Remove the desktop's accidental Actual title prefix.

Moderation notes are customer-visible account responses, not public review text.
Do not copy generated wording implying the note is displayed publicly with a review.
No invented publication policy or verified-purchase badge is introduced. Business
reviews have no linked purchase source; that is not proof of a completed purchase.
Existing notes and exact moderated timestamps remain available in their proper
read-only status views. Keep actual controls and original-outcome recovery semantics.
