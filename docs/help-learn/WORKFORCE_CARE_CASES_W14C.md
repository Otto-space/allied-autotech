# W14C: operational granular Care adapters

Branch `feat/workforce-care-case-adapters-20261027`, based on W14B `daaa2e2a`.
Local implementation and bounded acceptance; no publication or real delivery.

## Implemented contracts

Current branch view, public reply, assignment and live eligibility are distinct.
Legacy Customer Service retains case view/reply without gaining assignment/live.
New reply needs view and reply on the same branch; assignment needs view and assign.
Live eligibility additionally needs reply/live, and proves neither staffing nor
availability, support hours, capacity or functioning transport.

General enquiries and complaints support reviewed assignment to an eligible active
branch viewer/responder. View-only colleagues cannot receive reply work. Existing
Product/Vehicle Sales assignment remains, including a cashier whose assigned-record
scope starts through that assignment. New complaint assignee/assignment endpoints
reuse canonical Complaint persistence, CAS, audit and generic team notifications.
Existing enquiry routes/receipts remain compatible; complaint assignee metadata is
minimal and optional. Internal reasons stay in audit and create no public message.

Handler eligibility is filtered in SQL before pagination with supported pinned
policies, dates, branch and view/reply intersection. Foreign/ineligible cursors fail;
literal wildcard search stays literal. Initial scope precedes the record lock;
after waits and before final projection/commit, actor/handler authority is rechecked.
Case viewing also governs contact, counters, notifications and learning. Reply-only,
live-only and foreign operators cannot retrieve cases or their private alerts.
Revocation redacts stored notification destinations/references. Read-only Care help
has a queue walkthrough, without reply practice; direct practice links cannot bypass
the same-branch reply predicate. care-triage is v2, reviewed 27 October 2026.

The existing Staff/Admin workspace provides read-only history/contact, separate
reviewed public reply and assignment actions, and shared checked candidate selection.
A successful assignment retains the unsent reply; a successful reply retains the
unsubmitted assignment reason/selection. No draft is sent automatically. Denial,
identity change and mismatched scope dispose protected drafts/reviews. Unknown
assignment/reply outcomes block both through reload until explicit inspection and
reconciliation. Markers contain actor-keyed case ID/token/action/version/fingerprint,
never body/reason. No automatic retry occurs for lost/malformed/408/429 outcomes.

Both managed parsers now reject INTERNAL_NOTE even if a malformed response labels
it CUSTOMER. A unit reproduced acceptance before the fix. Existing database
kind/audience constraints already protect writes; no production leak is claimed.

## Actual verification

- Initial eight native HTTP/DB cases reproduced seven missing behaviours; existing
  Sales assignment passed. Final expanded14 pass: Staff/Admin read-only, action
  intersection, strict public bodies, stale versions, both assignment kinds,
  eligible pagination/cursors, competing writes, customer ownership/history,
  alert recipients/revocation, real row-lock reply expiry, and help/practice gates.
- Final61 workforce/session/learning regressions pass across12 current definitions.
  Exact loopback CI target, restricted non-owning runtime, schema and db:check were
  verified before writes. No schema change; prior73-migration replay/client evidence
  remains separate. No application database was used.
- Backend guidance/catalogue/access units21 pass. Full frontend1145/171files pass;
  focused Care/pending/enquiry/complaint/registry36 pass (overlapping receipts).
- New36 populated Chromium fixtures pass: Staff/Admin, enquiry/complaint, separate
  duties,320/390/768/1440, keyboard, audience, draft retention, rejection, candidate
  retry, revocation, unknown recovery through reload, Axe WCAG2.2 tags, overflow,
  console and external requests. All50 existing enquiry/complaint browser cases
  pass across the initial36, subsequent13 and final1 runs. Two assertions were
  updated for deliberately generic colleague/case wording; behaviour stayed intact.
- One actual browser/CSRF/API/restricted-CI-DB flow passes without interception:
  two reviewed assignments, two public replies, both versions2, four audits,
  zero internal messages, unchanged branch/inventory/bookings. Native-dialog/main
  Axe and390/1440 screenshots pass. Test sessions revoked and local cookie retired.
- OpenAPI381paths/445operations+4infrastructure, generated frontend types, source/
  script/frontend types, strict native harness/test compile, lint, secret guard
  (3260files), cached optimized build pass. A second warm build corrected the first
  preview's captured backend5000 address to5021; no generated manifest patching.
  Reused Next16.3.8 is not exact-lock16.4.3 release acceptance.

Browser plugin unavailable; installed Chromium/Playwright used. Screens under TEMP:
allied-care-view-{enquiries|complaints}-{390|1440}.png,
allied-care-assign-{enquiries|complaints}-{390|1440}.png,
allied-care-native-assign-{enquiries|complaints}-{390|1440}.png,
and allied-care-native-recorded-{enquiries|complaints}-390.png.
Desktop review/mobile read-only, native mobile review and populated queue inspected.
Logs and w14-care-native-evidence.json remain in the existing W7 CI evidence folder.
Two initial native runs exposed the preview port mismatch; a concurrent test-output
collision was corrected by sequential runs/separate native artifact output.

## Remaining boundaries

Persisted reviewed Allie handoff, shared staffed transport, separate support hours,
presence/capacity/claim/takeover and all106 exact route-learning decisions remain.
Live mode stays unavailable. W9 provider allowance is exhausted: no new calls or
public AI enablement. New written guidance has no fresh actual-provider review.
No real customer messaging/delivery, grants, inventory, install, worktree or Docker
build. Exact-lock CI, hosted/actual-role/device/screen-reader checks remain open.
Before separately authorised publication, reconcile later releases, deploy compatible
backend first, and verify pendingW7 migration/backup/restore gates. Canonical customer/
operator pages and legacy contracts remain. Full Revision4 continues after this batch.

Final measured C: free space: 24.92 GiB, above the mandatory 20 GiB reserve.
Read-only Docker review retained 91 image references (13.16 GB), 200 cache entries
(9.519 GB), 14 volumes (1.012 GB) and 13 stopped containers. No resource was proved
redundant; current/rollback/other-task images, useful caches and database volumes
remain. Previously denied dev-folder cleanup was not retried.
