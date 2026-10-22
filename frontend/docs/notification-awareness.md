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

## Release verification — 22 October 2026

- Source: `6df93869d470591886fbd0814fb7ddb4b54196c4`, branch `feat/customer-notification-awareness`.
- Canonical frontend: `dpl_HzhSjpFjzcyTSbkbkNmu6eKqUDs2`, READY, production, assigned to
  https://alliedautotech.com. The provider's commit matches the backend images.
- Active backend: `dddab932-5fda-48f8-a94c-6c3b558dc5e2`; all four immutable image digests match
  the release manifest. All four images use the non-root `node` account.
- Hosted verification: `2026-10-22T09:01:41.379Z`. Liveness/readiness passed;
  the customer notification route and exact review route serve successfully
  behind the existing perimeter gate; live CSS contains the count and dot badges.
  Both summary endpoints still reject requests without an application session.

Validation passed: **896 frontend unit tests**, **390 backend unit tests**,
**four isolated HTTP/database integration tests**, and **eight distinct focused
browser scenarios**. Types, lint, OpenAPI validation, route coverage, generated
API types, production build, formatting, secret scanning and whitespace checks
passed. Desktop/mobile screenshots were inspected. The final mobile check verifies
that the bell, account and sign-out targets do not overlap.

Browser tests caught the legacy mobile rule hiding the bell; it was corrected.
Visual review then identified compressed phone-header controls; spacing was fixed
and the affected mobile checks passed again. One later Playwright teardown failed
because a temporary trace file was missing; the same accessibility scenario passed
using a task-specific output directory. No application failure was suppressed.

The real API tests used the newly created isolated target
`127.0.0.1:58499/allied_notification_awareness_20261022_ci`, with a restricted
runtime role separate from the migration role. An empty replay of all 60 existing
migrations and the final `db:check` passed. Tests verified totals beyond the
first inbox page, expired/read exclusion, cross-account isolation, read-one/read-all
updates and retrieval of an older owned review without exposing another customer's
review.

There was **no production schema change, migration or direct customer-data write**
for this feature release. Before rollout, provider-managed backup availability and
the application-only firewall were checked again. The verified encrypted off-device
backup/PITR configuration and successful separate restore rehearsal from the
earlier same-day release were reused; no new production dump or restore rehearsal
was performed for this unchanged schema. The packaged pre-deployment database check
passed. Existing hosting resources, private access and launch restrictions were
preserved. These checks do not promise zero risk.

Local browser checks used synthetic account responses; no real customer or owner
password/session was used. Hosted asset and release checks do not substitute for
normal signed-in production acceptance. Vercel's automatic production branch still
names `master`; this feature branch must be reconciled before a later automatic
release replaces it. Prior deployment identities and image digests remain in
protected local receipts for an application rollback that preserves the database.
