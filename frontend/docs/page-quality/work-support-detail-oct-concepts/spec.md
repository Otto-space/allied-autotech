# Staff conversation specification, gate 77

One Overview > Customer care > actual subject breadcrumb/header, status/type or
priority, Refresh conversation and Back to customer care. Compact section navigation
links Details, Messages, Reply and Management. Grouped record/handling/contact facts
retain full IDs, current numeric version, exact Lagos creation/update/resolution/
closure/acknowledgement/deadline/escalation dates and honest nullable contact values.
Full original text and complaint resolution remain readable, not truncated previews.
Guest/no-account guidance is factual and does not promise account delivery.

Paginated history uses the dedicated messages API, oldest first, with independent
refresh/Next/Previous and URL cursor state where supported. Validate complete unique
message IDs, date/body/author/visibility, cursor advancement and hasMore consistency.
Do not use embedded detail messages or invent author identities. Customer-visible
entries and Internal staff notes have unmistakable text labels; avoid red as the
ordinary note color. No live-chat promise or fictitious read/delivery indicator.

Reply visibility defaults Customer-visible. Reuse the existing form/review controls
with parent current-identity/domain preflight and a full reviewed text/visibility
receipt. Manage assignment/unassignment, permitted status/resolution and complaint
priority only through supported APIs. Show current values and preserve exact
expectedVersion. Keep forms mounted as versions change; explicitly reload affected
fields before re-review. Full customer-visible response text appears in review.
First acknowledgement has a separate atomic once-only path and exact reviewed text;
already-acknowledged races must not claim a new response was added.

No new messages/acknowledgements after closure. Serialize backend staff replies with
closure using the conversation lock; reject new acknowledgement on CLOSED before
mutating. Return safe explicit message/outcome metadata if needed to validate new
text independently of the capped embedded history. Preserve MFA/branch checks,
atomic message/audit/outbox semantics and independent version effects. No schema
reset, migration, grant change or domain rewrite is anticipated.

Active own role/profile gates reads. Strict requested identity and Staff branch
scope prevent stale/foreign data. Fresh actor/relevant-domain checks precede sends;
backend CAS/locks protect the remaining race. Temporary read failures retain labelled
facts with changes blocked; summary denial clears protected history as well. Message
failure is independent and never masquerades as an empty conversation.

One parent single-flight/review guard covers management, acknowledgement and replies.
Minimal owner/role/kind/reference pending markers survive uncertainty/reload and
session invalidation redacts them. Explicit current record/messages reconciliation
replaces this page's unsaved fields without resending or proving the original outcome.
Definite rejection differs from an unsent preflight. No staff same-key retry is
offered without an actual durable backend receipt. Keep accepted Customer replay
flows and unrelated form defaults unchanged.

Quicksand30/24px header,16px sections,13px body/labels,>=44px controls, cool canvas,
white12px panels, subtle rules and restrained red. Desktop history/reply and handling
panels may form an asymmetric layout; narrow screens follow reading order with full
text/IDs and paired fact labels. Fresh desktop/mobile Image Gen before UI edits,
focused helper/browser/API/concurrency checks, real changes/audits, seven widths/
Axe/native fidelity and >=5 copy/fidelity points complete this separate gate.

## Inspected concept corrections before implementation

Both generated concepts have been viewed and saved. Retain actual Allied branding
and red actions; the desktop's blue logo/buttons are approximations. The generated
Stadium Road street/address in Lagos is false and must not be copied. This API
returns branch name/code/reference, not a workshop address. The confirmed public
workshop landmark remains133 Stadium Road beside Kilimanjaro, Port Harcourt.

The messages API returns author type, not a verified author name/avatar; label
Customer, Allied AutoTech team or System update without adopting invented names.
Do not repeat the original complaint as an invented message or say Showing all
messages on a paginated view. A recorded acknowledgement body/author is not supplied
as a separately linked historical field; display only returned facts/messages.
Keep the actual reply maximum4000 and acknowledgement maximum2000, not the desktop's
generic2000 reply counter. Generated management Resolution and Assign to combined
selectors/internal management note are not the current API: preserve explicit
assignment/status/priority operations and customer-visible response semantics.
