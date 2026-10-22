# Notification awareness

The dashboard bell shows the account's total unread notifications, capped visually
at `99+`. Screen readers receive the full count. Customer sidebar links show counts
for their related records; closed groups and the collapsed sidebar show a dot.
The mobile drawer uses the same state.

One account-scoped summary request covers the entire unread inbox, independent of
pagination. Read and expired notifications are excluded. Counts refresh every
30 seconds while visible and online, on returning to the dashboard, after manual
inbox refresh, and after confirmed read changes. Other open tabs are notified
without persisting account records. Sign-out and account changes discard counts;
failed checks are identified as unavailable rather than represented as zero.

Customer notifications link through a fixed route allowlist and validated record
IDs. Booking, order, payment, invoice, vehicle-purchase, enquiry, complaint and review
records have direct destinations. A refund referring to a booking opens that booking.
Review links load the exact owned review even when it is outside the first history
page. Unknown or missing record references do not generate guessed links.

Opening a related page does not silently dismiss the notification. The existing
**Mark as read** and **Mark all read** controls update the badges after the server
confirms the change. Notification links do not grant access to the linked record;
existing authentication, MFA, ownership and role checks remain authoritative.

The backend adds `GET /customers/notifications/summary` and
`GET /staff/notifications/summary`, plus an optional owned `reviewId` filter on
customer reviews. Summary responses are private and not cacheable. The workforce
boundary permits only the exact summary endpoint alongside existing personal
notification endpoints. No database schema change or migration is introduced.

Validation evidence and deployment identities are recorded separately in the
release receipt. Tests cover counts beyond the first inbox page, expired/read
exclusion, account isolation, exact older-review retrieval, malformed references,
read updates, responsive navigation and accessibility.
