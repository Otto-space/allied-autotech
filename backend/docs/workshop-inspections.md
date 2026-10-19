# Workshop inspection discovery and progress

Frontend route `/admin/inspections` uses the existing authenticated
`GET /staff/vehicle-inspections` collection and
`POST /staff/vehicle-inspections/:inspectionId/status`. There is no individual
staff inspection GET or separate inspection detail page. The collection accepts
status, branchId, UUID cursor and limit. Sorting is createdAt/ID descending.

Staff require an active assigned branch; explicit foreign branch filters fail.
Admin/Super Admin can read historical inactive-branch requests. Current actor,
MFA, CSRF, private/no-store and atomic expectedVersion checks remain server
boundaries. Responses expose customer display name and notes, without the stored
contact email/phone. The inspection projection has no branch label, stock ID or
thumbnail; the frontend must not fabricate these facts or direct links.

Progress transitions remain:

| Current                       | Allowed next statuses                      |
| ----------------------------- | ------------------------------------------ |
| Requested                     | Confirmed, Cancelled                       |
| Confirmed                     | Completed, Rescheduled, Cancelled, No show |
| Rescheduled                   | Confirmed, Completed, Cancelled, No show   |
| Completed, Cancelled, No show | None                                       |

Confirmation/rescheduling requires a complete positive schedule and an active
assignee at the listing branch. Staff actions assign their own staff profile;
Admin actions use the submitted assignee or retain the existing one. Even closing
an inspection validates any assignee's current eligibility. Cancellation requires
a reason. A successful transition increments only the inspection version and
creates one STATUS_CHANGE audit. Completion does not reserve a vehicle, create a
condition report, collect payment or create a vehicle transaction.

## Frontend freshness and recovery

Status/branch filters and cursor history survive URL navigation and reload. Reads
wait for current own profile and Staff assignment. Collection parsing validates
scope, dates/intervals, unique references and assignment consistency. Temporary
failure keeps facts read-only; denial removes them. Terminal statuses stay closed.

Before sending a reviewed transition, the UI checks fresh own access and the
record on the current authorized collection page. If the record moved out of that
page or changed, nothing is sent and the draft is kept for refresh/explicit field
reload. The backend's atomic version check still protects a change after preflight.
The full response must match ID, next version, status, listing/branch, assignee,
schedule and cancellation reason before success. Older reads cannot replace a
known newer version. A definitive backend rejection is reported as a rejection,
separately from a request that stopped before submission.

A minimal owner/role-scoped pending marker is verified before sending. Uncertain
responses, malformed/mismatched results, 408/429 and reload keep mutations locked.
Explicit current-page reconciliation replaces this page's unsaved drafts and
releases the lock without resending or claiming proof of the original outcome.
Session invalidation redacts metadata while retaining the lock. Unavailable
recovery storage fails closed.

## Optional durable outcome recovery

ADM-27 records optional P2 original-request receipts for inspection transitions.
If selected, define actor/reference/body binding, retention and an authorized
read-only lookup. Persist the transition, version, audit and receipt atomically.
Recovery must recheck current actor/branch scope and must not reopen terminal
states or replay a different schedule/reason/assignee. Prove committed/uncommitted
lost responses, concurrency, mismatched payloads, actor/branch changes and exactly
one transition/audit. Deliver contracts and explicit UI recovery together. New
storage requires the mandatory reviewed forward-migration workflow.

The current supported manual workflow needs no new endpoint, schema, migration or
permission. Local acceptance and target rollout limits are recorded in the
[frontend report](../../frontend/docs/page-quality/work-inspections.md).
