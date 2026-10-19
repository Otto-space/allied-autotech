# Administrator payments specification — gate 80

Use the accepted Quicksand dashboard theme: actual Allied logo/ink sidebar, white
account strip, cool gray canvas, white 12px bordered cards, restrained red primary
actions, 13px body, 30px wide/24px narrow heading and controls at least 44px high.

Overview > Payment records ordered breadcrumb. A compact heading and short purpose
description sit beside Refresh payment records/Refresh payment access and a real
Review refund requests link. No global metrics, charts, invented provider balances
or customer names absent from the projection.

One compact grouped filter card contains Payment status, Provider and optional
Customer profile reference, Apply payment filters/Clear payment filters. Supported
filters/cursor/history and selected payment/attempt survive reload/Back. Unknown
invalid query values fail safely; never forward UI-only selection/trail fields.
Explain any-attempt provider matching once. Page-local count and newest-first order;
Previous/First page/Next without an invented global page count.

Complete payment cards show payment number, actual status/purpose, exact NGN amount,
full UUID, created/deadline/succeeded/cancelled/expired instants when recorded and
real source UUID links. Use exact Lagos milliseconds, including very large amounts
without Number conversion. Payment amount is neither captured-total nor remaining
refund balance. No customer profile link without a returned actual customer ID.

Every attempt remains visible with its full reference, actual sequence/provider,
method/status/verification, amount/currency and initiated/paid/verified timestamps.
Manual evidence facts show payer, bank reference, transfer/submitted/reviewed dates,
actual decision and safe recorded reviewer note where the staff contract permits.
Private evidence control uses existing temporary access; do not show raw object
keys/checksums. Terminal attempts are read-only except supported refund initiation.

One deliberate active manual/refund workspace per page: source/evidence facts left,
grouped form right on desktop; facts then form on mobile. Pending manual decision
uses a select, multiline reviewer note and Review manual payment decision. Four-eye
eligibility must be current and backend-enforced; do not expose a reviewer action to
the original submitter if the API can determine this. Successful+verified attempts
offer a labelled refund request workspace, amount in NGN and multiline reason.
Captured amount is labelled as original capture, not a remaining refundable balance.

Full confirmation includes payment/attempt/source identifiers, exact money and
manual evidence details/decision/note or refund amount/reason. One parent guard,
fresh active identity/current record and authoritative backend concurrency precede
sends. Validate exact safe receipts before success; clear only the saved form's
scoped draft. Cancellation preserves opener focus and drafts with no needless read.

Minimal owner/role/payment/attempt/operation pending markers survive uncertainty/
reload; redact private references while retaining locks on session invalidation.
Explicit current-payment reads recheck access and never resend or prove the original
outcome. A changed status outside filters still displays complete current facts.
Retain an exact same-key refund retry only when its original immutable body/key and
actor remain available; do not fabricate durable original-request recovery.
Temporary failures retain labelled facts with all mutations blocked. Denial clears
private cards, evidence controls, receipts/forms and supports independent access
recovery. Blocked storage must stop dispatch before sending an unsafe mutation.

Mobile wraps full references/notes without horizontal page scrolling; controls/forms
stack deliberately down to 320px. Accessible rating is irrelevant here: use semantic
status text, labels, ordered breadcrumbs, field errors and native confirmation focus.
Respect reduced motion. Preserve every useful backend-supported operation/content.

Four-width baseline/audit is complete. Fresh desktop/mobile concepts, inspected
corrections, production tests, API/database evidence, responsive/Axe, native fidelity
and at least five copy/layout comparison points are required before acceptance.

## Inspected concept corrections before implementation

Both fresh concepts have been viewed and saved. Retain the existing Allied logo,
actual dashboard navigation and Find a page control; the generated cross-entity
search placeholder does not establish working backend search. Restore the actual
white account strip omitted from the desktop reference. Use restrained existing
red actions instead of red borders on every secondary control.

Generated ORD numbers and the second card's altered amount/dates are illustrative
errors. Show actual source UUID links and API-recorded money/dates; never invent
order numbers absent from the projection. Keep full attempt/payment references.
The manual reviewer note is **required**, not optional. The reviewer must be a
different operator from the submitter; the current eligible administrator performs this
review now, not an implied future reviewer. Explain this four-eye rule accurately.

Request payment evidence authorizes temporary private access for the operator;
it does not automatically share evidence with the customer. Preserve actual storage
configuration and safe unavailable/expiry states. Do not adopt the mobile's sharing
claim, red warning styling for normal instructions or its invented note counter.
Do not introduce collapsible records that hide useful facts merely to fit the image.
The selected form may expand deliberately; all attempts and supporting facts remain
available. At 430px stack controls even though the generated mobile reference is
actually wider. Measure returned PNG dimensions rather than relying on prompt size.
