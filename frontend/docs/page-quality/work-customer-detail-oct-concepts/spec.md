# Customer detail specification, gate 75

One Overview > Customers > actual full-name breadcrumb/header, status, Refresh
customer and Back to customers. Two grouped contact/account and address panels show
full profile UUID, name, email/phone, independent verification, precise registered
date and each returned address component. Null/empty means Not provided. Decorative
initials only; no invented portrait, branch or customer lifetime totals.

Activity is a labelled button/link group for Garage, Bookings, Quotations, Orders,
Payments, Enquiries and Complaints, persisted as supported collection/cursor/trail
URL state through reload/Back. Collection changes reset paging. UUID cursors are
per-customer/per-collection, separate from opaque directory cursors. Unknown or
duplicate query values stop collection reads. Complete labelled records retain full
reference/title/status/date/amount. Format decimal minor-unit strings exactly;
null amount is absent, zero is zero, and unknown currency is not labelled NGN.
Link only real existing authorized record routes; no unsupported garage action.

Active Admin/Super Admin identity gates direct reads. Enforce requested UUID and
strict unique/bounded related records. Profile refresh failure retains labelled
facts but blocks related navigation/reload until a fresh summary succeeds. Summary
denial clears activity. Related outage remains isolated with old rows labelled;
related denial clears those rows without claiming the profile is unavailable.
Read-only privacy audit logging remains unchanged. No mutation or backend schema.

Reuse dashboard Quicksand 30/24px title,16px sections,13px body,>=44px controls, cool
canvas and white12px panels with restrained red. Reflow mobile facts/activity to
paired labels/values without horizontal tables. Fresh desktop/mobile Image Gen
concepts before UI edits, focused helper/browser checks, existing API evidence,
connected real summary/collections/cursor/read-audit checks, seven widths/Axe and
native concept/final comparison with >=5 copy/fidelity points complete this gate.
