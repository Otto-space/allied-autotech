# Workshop support conversation contract

Reviewed 18 October 2026. Applies to staff enquiry and complaint detail at
`/admin/support/[kind]/[supportId]`. The [queue contract](workshop-support-discovery.md)
and customer original-request recovery remain separate.

## Access and reads

Existing `/staff/support/enquiries/:supportId` and complaint equivalents require an
active staff role, verified MFA and current branch authorization. Admin and Super
Admin retain their existing privileged read audits. Staff branch assignment remains
authoritative at the API. Contact fields can be null for linked customer complaints;
the frontend displays honest missing values rather than inventing contact data.

The dedicated `/:supportId/messages` collection is the history source: oldest first,
up to 50 records per page, cursor and `hasMore`. Embedded detail messages are capped
at the oldest 500 and are not a complete history or a reliable new-message receipt.
Message authors expose type, not an invented verified staff name/avatar. Internal
notes and customer-visible messages keep their existing access rules.

The frontend verifies current own identity/role/branch before private reads and
before writes. It validates requested reference, related identities, branch scope,
version, chronological unique history and advancing cursors. Temporary failures keep
labelled prior facts read-only; denied summary/history/recovery reads clear the
protected conversation. Cursor state survives reload and browser Back.

## Additive lifecycle and response changes

No request, endpoint, schema or migration changes are needed.

- Staff message creation now locks the Enquiry/Complaint row before checking CLOSED.
  It serializes with closure, preventing a new message after a concurrent close.
- A first acknowledgement of an unacknowledged CLOSED complaint returns 409. An
  already recorded acknowledgement remains a non-mutating outcome, with no second
  response message.
- Staff message responses add `conversationId` and `conversationKind` to the existing
  safe message projection (`id`, `authorType`, `visibility`, `body`, `createdAt`).
- Enquiry/complaint status responses add `messageReceipt`: that safe scoped message
  when the reviewed response/resolution created one, otherwise explicit null.
- Complaint acknowledgement adds `acknowledgedNow` and `messageReceipt`. First
  acknowledgement returns true and its exact scoped customer-visible message;
  an already acknowledged outcome returns false and null. The frontend must not
  claim the newly reviewed response was added in the latter case.

Receipts are current response metadata, **not durable original-request receipts**.
They contain no author user ID, raw private storage object key or delivery promise.
Messages, acknowledgements, existing notifications and audits remain atomic in their
existing transactions. Assignment, priority and status retain expected-version CAS
and advance the record version once. Replies and acknowledgement do not advance it.
The current OpenAPI response envelope uses an unknown data payload, so these
additive projections require no generated request-type change.

## Reviewed writes and recovery

One conversation-level review/single-flight guard coordinates assignment, removal,
priority, status/resolution, first acknowledgement and customer/internal replies.
It rechecks current actor and relevant domain facts, then validates the exact saved
reference, version effect, body and visibility. Version changes preserve unsaved
management fields until the user explicitly reloads them. A first acknowledgement
race that returns false states that the reviewed response was not added.

Uncertain responses retain minimal owner/role/kind/reference pending metadata across
reload, without saving message bodies in that marker. Session invalidation redacts
marker values while preserving the lock. Explicit **Load current conversation**
rechecks access and loads the current record and message page, replaces only this
conversation's unsaved fields, and never resends or proves the original outcome.
Definite API rejection is distinguished from an unsent preflight. Customer durable
same-key replay remains unchanged.

## Optional durable outcome recovery

If selected, define actor/operation/reference/body-bound original-request IDs,
retention and authorized read-only lookup. Persist message/domain/version,
notification, audit and receipt atomically. Recheck current role/branch on receipt
lookup; original authorization alone must not expose revoked private access.

Prove committed and uncommitted lost responses, parallel requests, changed bodies,
different actors, branch reassignment, expiry, closed records and acknowledgement
races. Exactly one intended message/change and audit may be created. Return an
explicit already-acknowledged outcome without claiming a new body was saved. Deliver
OpenAPI/client contracts and deliberate UI recovery together. Use the mandatory
forward-migration workflow if storage is added; preserve existing data and constraints.

## Verification and rollout boundary

Five focused API/database scenarios cover dedicated 50+3 history, role/branch/MFA
privacy, a receipt beyond the 500 embedded-message cap, exact status/assignment/
priority versions, once-only acknowledgement, closed first-ack rejection, and an
explicit held-row-lock closure race with no extra message/audit. Tests use the
verified isolated `_test` target and existing restricted runtime credentials.

Deploy the additive backend changes with the dependent frontend; validate real
branch/role/MFA, private caching, review, history and recovery behavior in the target
environment. Notification persistence is not proof of provider delivery. Business
policy, privacy review, moderation and finance acceptance remain separate. No
application/shared database, schema, migration, grant, backup/restore or deployment
operation is part of this page change. Existing unchanged migration replay,
`db:check` and runtime privilege evidence is reused; no new restore test is claimed.
