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

## Support replies and delivery

After confirmation, a customer-visible reply queues one email in the same database
transaction as its message. Guests receive the response body and can reply to the
configured Support mailbox without registering. Linked customers receive an account
notification and, if operational email is enabled for them, an email with a sign-in
link to their conversation. Their private response text stays in their account.

Status changes and their optional resolution text create one combined update.
Resolving an enquiry therefore does not require copying the resolution into Reply.
Internal notes, assignment changes and merely opening/cancelling Review send no
customer update. Complaint acknowledgements notify once. Both the main Support
workspace and responsibility-based staff reply screens use this flow.

The Customer email delivery panel shows the latest 20 updates and can be refreshed
without resending anything. Queued/Sending are pending; Retrying means an automatic
retry is scheduled; Failed means automatic attempts stopped. Not sent explains an
opt-out, disabled channel or missing address. Sent means the provider accepted the
message, not proof of inbox delivery or reading. Existing pre-release messages are
not resent or backfilled. Emails received in Google Groups are not automatically
imported into the website conversation. Staff must check the mailbox when following
up and avoid manually duplicating a queued reply.

The new worker uses the existing encrypted outbox, bounded retries, claim fencing,
staging recipient allowlist and provider idempotency key. It rechecks account email
preferences before sending. Delivery metadata is scoped to the authorised conversation;
recipients, message payloads and raw provider errors are not returned in the panel.
No schema migration, additional paid service or browser-push subscription is added.
Browser push remains a later opt-in feature.

## Workflow visualisation

Shared colours identify status labels across customer, admin and workforce screens.
Labels remain visible so colour is not the sole distinction. Detailed enquiry,
complaint, booking/work-order, quotation, order, payment, invoice, inspection, vehicle
purchase/listing, refund, aftercare, privacy and dispute workflows show stage guides.
The guide highlights only the recorded current stage. It does not infer completed
stages, invent timestamps, promise an outcome or convert a stage into a percentage.
Cancellation, expiry, rejection and unknown server states stay explicit. Existing
dated histories are preserved. Mobile guides stack vertically.
