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

## W15A2/B implementation and local acceptance (27 October 2026)

The preceding frontend-incomplete checkpoint is superseded by this implementation.
The existing panel now offers Customer Care immediately to a verified customer,
including when AI is disabled. Customers edit the issue, choose a branch/new enquiry
or one of their own existing open enquiries/complaints, and optionally select up to
two individual current help message parts. Nothing is selected automatically. The
exact review repeats the branch, canonical destination, audience and queued status.
Sending is a deterministic CSRF-protected application action, never a model tool.
Guests use Contact without an attached transcript. Work guidance has no customer
forwarding form; no unverified internal escalation link is invented.

Preparing a keyed review stores an immutable encrypted draft in the existing
IdempotencyRecord, bound to user/session/operation. At most three active reviews
per session expire within 15 minutes. Ordinary unkeyed preview callers remain
compatible. GET/DELETE handoff/drafts/:operationKey recover or cancel a review;
the current session and target/source eligibility are checked again. Stale selected
help is removed while the manual summary stays editable. Cancellation and submission
serialize on the same operation lock. A late original request cannot write after
cancellation; if saving won, cancellation returns its owned reference and preserves
the case. An expired operation can be cleared without extending its write window or
allocating a fresh receipt. Bounded retention cleanup removes only expired transient
encrypted drafts, never canonical cases or durable handoff receipts. No migration.

The browser retains only a non-bearer operation ID in sessionStorage. Unsubmitted
manual editing stays in identity-bound React memory when help is closed/reopened;
it is not copied into general form recovery or sent to the provider. Review recovery
uses the server-encrypted exact draft, not browser transcript storage. Corrupt or
unavailable recovery storage fails closed. Unknown/malformed/lost results retain the
operation and block a different submission until checked or safely cancelled. No
automatic send/retry. Separate unsent AI and support drafts are retained. After a
selected source is handed off, separate AI help requires an explicit new start.

Local evidence:

- 21 focused native handoff cases, including encrypted recovery/session ownership,
  concurrent save/cancel, lost acknowledgement, expired cancellation, bounded cleanup,
  audit rollback, public/internal privacy and delayed mocked-provider completion.
- Seven-suite regression run accepted 115 cases; its remaining learning case still
  expected article v4. The maintained customer article is now v5 and explains exact
  review, selected sharing and queued recovery. Its revised HTTP check is being
  revalidated separately. The preceding pre-content-change full116 run passed.
- 84 provider/state/evaluation/guidance unit cases and eight handoff component cases
  pass, in addition to eight contract/privacy/operation-marker cases. The first new
  component run lacked the test matchers import; adding it fixed that harness error.
- 32 distinct rendered fixture cases accepted across the existing Allie conversation
  and new handoff suites, including 320/360/390/768/1024/1440 widths, all account tiers,
  AI-off fallback, explicit sharing, existing destinations, cancellation, loss/reload,
  stale review, storage privacy, draft continuity, keyboard/focus and scoped Axe.
  A new fixture initially omitted the API envelope's message; the client correctly
  rejected its choices. Correcting that fixture restored populated choices. Three
  legacy console checks now use the existing response-verified not-found stylesheet
  warning classification; operational CSS/runtime errors remain asserted. The
  source fixture now returns a fresh context after handoff, as the real API does.
- One actual browser/CSRF/API/restricted-CI-DB composition saved exactly one General
  enquiry and one public reply to an existing complaint. Both were read in canonical
  customer history and the scoped operator queue. Two audit entries, one preserved
  internal note, and unchanged inventory/bookings were verified. This used synthetic
  accounts only, AI off, no worker or external delivery. Test sessions were revoked
  and the temporary cookie file removed after verification.
- Optimized build/postbuild, source/script/native helper typechecks and full frontend
  lint pass. Full frontend units, final contracts and exact-source checks remain in
  progress until recorded in the final addendum below. Installed Next16.3.8 remains
  different from locked16.4.3; no duplicate install was made.

Screenshots outside Git: %TEMP%/allied-handoff-review-{360,390,768,1024,1440}.png,
allied-handoff-native-review-{390,1440}.png, native-customer-history-1440.png and
native-operator-390.png (the latter two share the allied-handoff- prefix). The 360px
fixture and1440px native exact reviews were visually inspected. Browser plugin not
available; repository Playwright and the installed Chromium were used. Physical
devices, native zoom and complete screen-reader acceptance remain unverified.

No provider call, real customer message, production seed, install, Docker image or
publication occurred. W9's provider allowance stays exhausted; v5 has no new actual
provider evaluation. The owner's later instruction authorises a reviewed committed
production release, but actual current-source reconciliation, migration73, backup/
restore, exact-lock CI and provider/domain verification remain separate release gates.
Full Revision4 is active: shared staffed/gated transport, operational readiness and
all106 exact-route completion decisions remain open. Two customer support matrix
entries now carry the partial W15 evidence without claiming route completion.

### Final local verification addendum

All116 distinct native cases across the seven suites are accepted:115 passed in
the final broad run and all11 learning cases passed after updating the maintained
v5 assertion. No runtime behaviour was weakened. Full frontend1161/173files,84
Allie backend units,32 distinct browser fixtures plus the real native composition,
optimized build/postbuild, full frontend lint, backend lint, source/script/helper
types and secret guard3277 pass. OpenAPI385paths/450operations+4infrastructure
validates; all106 route entries remain explicitly incomplete. Generated frontend
contracts are checked against the canonical exporter. No real-provider re-evaluation.

The broad frontend run took604.64seconds with a single worker; no duplicate run or
dependency install was created. C: postflight measured23.34GiB free. Read-only Docker
review retained91 image references,200 cache records,13 stopped containers and14
volumes; current/rollback/other-task usefulness was not inferred away. No deletion
or new image build. These are point-in-time measurements, not an OS quota.
