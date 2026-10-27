# W15: reviewed canonical Customer Care handoff (active)

Based on W14C adca9076, in the existing release worktree. This is implementation
work, not an accepted journey or publication. No paid provider call is authorised.

## Acceptance contracts before implementation

The canonical records remain Enquiry/Complaint and SupportMessage, with the existing
customer history/detail and authorised Care queue. No second inbox or guessed match.
Signed-in customers can deliberately create a General enquiry or select their own
existing enquiry/complaint. Account identity comes from the current session. Guests
use the existing secure Contact workflow; a typed email/UUID grants no history.
Workforce guidance cannot be forwarded through the customer handoff endpoint.

The customer edits a summary and may explicitly select individual question/answer
excerpts from their current customer help conversation. Selection defaults to none.
The server resolves owned, current, eligible excerpts; no client-supplied transcript
or automatic full-chat attachment. A bounded exact preview identifies the recipient,
canonical destination and queued status. A short-lived keyed review binds the exact
summary, selected excerpts, branch, target/version and session. Submission requires
explicit consent. Cancel/review makes no operational write. No live promise.

An operation ID plus owner/payload-bound server receipt prevents duplicate writes
after double-click, retry or lost acknowledgement. Recovery returns only the owned
canonical reference. Failed drafts remain editable; uncertain outcomes remain blocked
until checked. Browser recovery contains no transcript/summary/credentials. New handoff
drafts do not overwrite existing support or assistant drafts. The model has no send
tool and never receives the user's support summary or operational records.

Native fixtures must establish: preview isolation; new/existing cases; session-derived
identity; strict contracts; foreign/closed/inactive targets; stale review/version;
duplicate/concurrent writes and mismatched replay; excerpt ownership/session/audience/
expiry/source changes; no internal-note/transcript leakage; provider-off/quota fallback;
current receipt access; and cancellation of pending AI work after committed handoff.
Frontend gates then cover edit/select/review/cancel/send, preserved drafts, exact
audience, receipt/deep link, loss/reload/retry, account changes, keyboard/Axe and
360/390/768/1024/1440px. Existing customer/operator workspaces need regression checks.

## Readiness and remaining work

No live support schedule, presence/capacity/claim/takeover or shared transport is
accepted yet. Existing login or Care duties do not prove staffed availability.
Asynchronous handoff is independent of provider and staffing configuration. Full
Revision4 and all106 route-learning decisions remain open. Implementation and actual
verification results will replace this active checkpoint after each bounded batch.

## W15A backend acceptance (27 October 2026)

The canonical asynchronous backend is implemented locally. POST handoff/preview,
POST handoff and GET handoff/receipts/:operationKey live under the existing protected
customers/support router. Strict bounded schemas, current verified customer session,
trusted origin/CSRF, active branch, explicit target/version and keyed ten-minute
review govern writes. New requests use General enquiries; existing owned enquiries/
complaints receive a customer-public reply. No second inbox or guessed matching.

Only selected current customer-session help excerpts can be copied. Work/guest/
foreign-session/expired/cleared/changed-source context is rejected. AI excerpts are
labelled as generated guidance, not verified evidence. Selected context is ended
transactionally after success, pending turns cancelled and delayed mocked-provider
answers discarded. No provider is used to create a summary or submit support.
Manual summaries remain customer editable. Plain handoff works with AI disabled.

Existing IdempotencyRecord stores an owner/payload-bound hash and minimal canonical
reference for24hours, without summary/transcript. Same-key replay survives transient
help erasure. Creation/message, audit, notification intent, context ending and receipt
commit atomically. A failed audit rolls them back. Saved/Queued does not claim external
delivery or human reading. No schema or migration; existing support retention applies.

Initial7 native contracts reproduced6 missing behaviours. Final14 focused native
cases pass, including concurrent writes, ownership/tier/CSRF boundaries, exact review,
selected excerpt consent, stale/closed targets, receipt privacy and pending generation.
An existing database constraint correctly rejected an incomplete closed fixture; the
fixture now supplies legitimate resolved/closed dates and asserts that constraint.
A stale fixture assertion was corrected to the existing direct workforce response.
The final7-suite run passes109 cases, including legacy support creation/reply replay,
Allie conversations, learning, active sessions and W14C Care. Seventy provider/state/
guidance units and51 workforce contract units pass (overlapping receipts are separate).
OpenAPI384paths/448operations+4infrastructure validates; frontend types regenerated.
Source/script/native/frontend typechecks, lint and secret guard pass. No new build
or real model call was needed for this backend-only stage.

The frontend handoff form, review/cancel/failure/reload recovery, draft preservation,
responsive screenshots and actual browser/API/DB composition are not implemented
or accepted yet. Complete these next, then shared staffed/gated transport and106-route
learning acceptance. Existing preview3167 still serves W14C. No publication, real
customer message, external delivery, new database/worktree/install or Docker build.
