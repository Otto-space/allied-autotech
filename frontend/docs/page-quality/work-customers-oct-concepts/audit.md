# Customer directory audit, gate 74

Route `/admin/customers`; customer detail remains a separate gate. Source and API
review completed before UI edits. The existing list has supported name/email/phone/
ID prefix search, status/email-verification filters, newest/oldest registration sort,
25-row cursor paging and named detail links. It has no management mutation route.
The repository escapes literal pattern characters, normalizes whitespace/case and
binds opaque cursors to filters/sort. Admin/Super Admin plus verified MFA are required;
Staff cannot browse. Collection/detail reads produce privacy READ audits and private
no-store responses. No new endpoint/schema is needed for the supported list.

Existing visual issues: repeated generic heading/breadcrumb, large full-width lead,
filters and actions in separate blocks, horizontal table on narrow screens and
generic View links. Initial-letter avatars are acceptable as initials, not photos.
Current filters/cursor are memory-only, so reload/Back loses context. The existing
parser does not reject duplicates or invalid cursors. Refresh failures need explicit
read-only old-record wording and access denial must clear protected records.

Reuse the accepted own-profile gate, URL filter/cursor utilities, compact workshop
header/panel styling, date formatting and honest loading/error states. Keep all name,
email, phone, account/verification and registration fields complete. No guessed
customer counts, branch filters, invented activity/spend totals, status edits,
creation, messaging or portrait photos. Search remains explicitly submitted to avoid
repeated audited requests on each keystroke. No customer PII in logs or fixtures output.
