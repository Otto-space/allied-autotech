# Revision 4 W5: navigation and active workspace boundaries

Local branch `feat/workforce-navigation-policy-20261026`, based on W4A `76719cc1`,
in the existing `allied-home-restoration-20261025` worktree. This is not a production
deployment. Other worktrees, their previews, release resources and source
changes remain preserved. Reconcile newer releases before any separately approved
rollout; this document does not assert that the earlier W3 release is still latest.

## Policy and visible behaviour

`frontend/lib/workforce-registry.ts` maintains the actual managed-workforce
destinations, UUID detail routes, AND/OR capability predicates, applicable scope,
feature availability, group/order and reviewed learning IDs. Sidebar, direct-page
guards, overview links and the existing fitment helper consume it. Workshop and
enquiry assignment actions use the same scoped predicate evaluator while retaining
their existing record-state and independent-review rules. Empty groups disappear;
several grants do not duplicate a destination. Existing responsive navigation and
URL-based queue filters remain in place. Learning references are IDs for resolution
against a fresh eligible server catalogue, not preauthorised article bodies/actions.

The registry consumes `workforceSnapshot`, the existing current server policy. It
does not grant access or replace API checks. A new responsibility maps through its
controlled capabilities, not a separately authored sidebar tree. Existing broad
legacy APIs remain inaccessible to enrolled Staff/Admin; current operational APIs
still check branch, assigned person, fields and state inside their transactions.
No payment, promotion, live-chat or independent-approval authority is added.

The server's additive projection now includes:

- `capabilityScopes`: capability / branch / branch-wide-or-assigned tuples derived
  from active, known pinned assignments. Branch scope subsumes assigned scope only
  in that same branch; grants never combine into company scope.
- `accessRevision`: an opaque canonical hash of current identity/tier, workforce
  revision, active assignment identities/definitions/scopes and management envelope.
  It is an invalidation hint, never a credential or permission override.
- `nextChangeAt`: the next known valid assignment start or expiry, or null. Future
  assignments are considered for scheduling but supply no present permissions.

Current clients reject incomplete, foreign-branch and stale-time projections. Old
servers' permission-only responses remain readable, using a stable full projection
key as a compatibility fallback. The key also compares actual fields even when an
opaque hash is supplied, and ignores timestamps/database ordering. Existing clients
can ignore the additive response fields. No database schema or migration changed.

The protected owner baseline is now preserved in the session's workspace selector:
a Super Admin business-position record does not force that owner into a narrowed
managed sidebar while the server still permits owner operations. This fixes a
verified code-path disagreement without creating Super Admins, changing positions,
granting anything new or weakening owner/bootstrap restrictions. A synthetic owner
business-position row also reproduced a 403 in legacy invitations: the helper
incorrectly applied delegated-admin restrictions to that existing owner. It now
checks the inviter's current database role and preserves only the established
SUPER_ADMIN baseline. Caller MFA, current password, locking, recipient and all
ordinary delegation checks remain intact. Unenrolled legacy
Admin/Staff keep their existing explicit compatibility boundary. Delegation still
does not confer the day-to-day duties it can manage. Historical management/revocation
under a reviewed envelope is preserved; inactive operational branches supply no
operational grants. Independent financial grants are not casually unioned into
managed legacy access; that broader policy composition remains open.

## Active-session contract

After a verified workforce/account change, the existing change coordinator emits
a same-origin recheck hint. Broadcast messages contain only type plus a random
document identifier; they carry no account, role, permission, customer or record
data and exclude their own echo. Failed/unavailable broadcast transport cannot
turn a confirmed save into an uncertain one. Other browsers use the existing
bounded 30-second refresh, plus online/visibility/focus and server-relative known
start/expiry checks. This is not a promise of instantaneous cross-device UI updates.
The next server request/consequential operation always revalidates current policy.

When a verified projection changes or becomes unavailable, the client aborts and
discards stale protected GET responses, remounts the managed workspace, removes
protected work drafts, redacts existing uncertain-change markers instead of
replaying them, clears notification summaries and closes/discards staff notification
previews, and invalidates learning content,
open Allie panels/guides and learning progress. Public/customer enquiry drafts,
other users' drafts and personal security/notification drafts are excluded from
the scoped work-draft cleanup. An invalid draft-storage key cannot prevent cleanup
of valid protected keys. No unsent draft is automatically submitted.

A forbidden page never mounts its old operational component and is replaced with
`/admin?workAccess=updated`, whose fixed explanation points to the remaining
permitted tools. Arbitrary destinations/parameters are not accepted. Direct stale
notification/copied URLs follow the same guard. A branch change that leaves the
module available still causes its inaccessible detail to be freshly denied/cleared.
Explicit record keys preserve the prior job/booking boundary during client-side
detail navigation; the first record's draft must not follow a second record.

Pure additions show new tools without changing account tier, opening a module or
forcing a tour. The conservative workspace-revision reset can discard unsent work
even on an access addition or position revision. Selective retention of an already
authorised in-memory work draft across such changes is not claimed. Already submitted
mutations are not retrospectively cancelled or replayed by GET invalidation; their
existing receipts, journal and reconciliation safeguards remain authoritative.

No operational WebSocket/SSE chat subscription exists yet. This batch cancels HTTP
reads and current browser subscriptions/listeners; real chat room reauthorisation,
revocation, staffing/capacity and queued transfer remain required implementation.

## Actual verification

- Reused the newly created W4 synthetic target
  `127.0.0.1:63888 / allied_workforce_effective_20261026_6970069e210b_ci`.
  Its 72-migration empty replay/schema check was established in W4. This batch
  reverified actual host/port/native data directory, DML-only runtime restrictions
  and `db:check`. No application/shared/production database was changed or reset.
- The actual HTTP/DB session-policy file passes **13 cases**: all eight controlled
  responsibility definitions' registry predicates against real queue/fitment APIs,
  overlap/final revocation in the same session, unchanged-version future activation
  and expiry, branch deactivation, owner-baseline selection, MFA, ownership and
  rejection of an opaque-revision header as authority. Together with existing
  workforce/effective-access/learning cases, **40 distinct cases accepted** across
  runs. The restricted learning article `work-access` is updated to version 3;
  its seven HTTP cases were rerun after the text update. Real customer cases,
  notifications, invitations or messages were not sent.
- Additional role/delegation/template/directory regressions: 35 distinct cases
  accepted across bounded runs. The first run passed 34 and exposed the owner
  invitation defect above; after the fix all six role-transition plus all 13
  session-policy cases passed together. In total **75 distinct HTTP/DB cases**
  accepted, not one 75-case run. Repeated cases are not additional coverage.
- Full frontend suite: **1,086 passed in 165 files**; full lint and types passed.
  The later route-key preservation correction passed **29 focused cases** across
  route-boundary, registry, invalidation and existing form-draft tests. Two new
  route-boundary cases first failed with the old draft retained, then passed with
  explicit record keys. Existing independent-review, same-branch AND predicates,
  device-clock skew, broadcast echo/failure, stale responses, old-server parsing
  and public/private draft boundaries have targeted coverage.
- A subsequent completed-notification-preview test first failed because cached
  staff items remained after access invalidation. The corrected preview closes
  and discards staff state while retaining the independent customer preview.
  All five preview tests passed; the final focused run passed 16 cases in four
  files. Full frontend lint passed again after this runtime correction.
- Backend types, lint, script checks, 366-path OpenAPI and 426-operation route parity
  passed; generated frontend contracts refreshed. Contract export initially needed
  explicit synthetic validation-only DB environment values; no connection/writes
  were made to that nonexistent contract target. The earlier nullable-array example
  generator limitation remains separate from the validated schemas.
- Final optimized build/standalone preparation passed, including type checking.
  Receipt: `%TEMP%/allied-workforce-policy-build-preview-accepted.log`.
  Installed Next remains 16.3.8 versus locked
  16.4.3. No new locked CI, hosted real-role or physical-device acceptance is claimed.
- Browser plugin not available. Installed Playwright first used Edge; after disk
  interruptions, the already installed bundled Chromium was used with isolated
  API interception and separate bounded child processes (no download/profile copy).
  **87 distinct cases accepted in 12 batches**, zero skipped/flaky/unexpected in
  the accepted receipts. New acceptance covers open review/draft revocation at
  390/1440px, a late response, two tabs, additions, unchanged-ID branch changes and
  a foreign current-access response. Initial critical browser run: five passed,
  two test-expectation failures (collapsed group not expanded; pre-existing 404
  heading incorrectly assumed). The fixture interactions/assertions were corrected
  to the actual existing UI; denial, no-write and no-private-data assertions remain.
  Other harness corrections were the exact legitimate personal notification summary,
  Next's route announcer versus the main alert, the intended final expiry redirect,
  and Chromium's name/reference whitespace in an exact-identity technician radio.
  No permission or write assertions were weakened. The seven critical cases and
  existing access (5), directory (8), access editor (13), job detail (33) and
  notifications (21) comprise the 87; interrupted runs are not counted as complete.
- The 390/1440px screenshots were visually inspected: readable explanation,
  cleared private work/review, retained personal tools and no horizontal overflow.
  Axe WCAG 2.2 AA tags and page-error checks passed. The same two cases passed
  again with console warning/error capture after adding the exact job-notification
  context's truthful empty fixture (previously the catch-all returned 403).
  An initial separate console run used Playwright's default port 3000 and did not
  reach the app; it was rerun on the verified 3167 preview. Actual browser console
  warnings/errors and page errors are empty in the accepted two cases.
  Screenshots: `%TEMP%/allied-workforce-revoked-390.png` and
  `%TEMP%/allied-workforce-revoked-1440.png`.
- Inventory regenerated: **106 routes / 338 interaction-boundary files**. Structural
  coverage is not complete route learning. The completion gate remains unmet.

Initial full checks caught one malformed-storage-key cleanup failure and two hook
dependency warnings; all were corrected before final checks. An added integration
case was initially nested by a patch anchor, then its owner-overview request lacked
the required date range; these test defects were corrected without weakening API
validation. An early build was stopped to incorporate those source corrections.
Logs are retained outside source under `%TEMP%/allied-workforce-policy-*` and the
existing isolated DB receipt folder. Repeated cases are not counted as additional
distinct coverage.

## Disk and remaining scope

A later build preflight correctly stopped when C: temporarily fell to 20.07 GiB
(below the 21 GiB needed for the budgeted build). Reviewed obsolete `.next/dev`
cleanup was rejected by automatic approval review with "blocked by policy"; no
deletion happened and no alternate deletion tool was attempted. The exact four
folders remain pending optional owner approval. Free space subsequently recovered
to 27.6 GiB without deletion, and the normal 1 GiB-growth preflight passed again.
Windows' current pagefile reservation was observed, but its growth was not measured;
no cause for the transient free-space change is asserted and no system file was
modified. Current production caches, other tasks' preview resources, source, dependencies,
databases, Docker current/rollback images and useful shared caches were retained.
The accepted 12 browser batches measured a minimum 27.074 GiB free; post-check
space was approximately 27.15 GiB. This is task-local sampling, not a global quota.

Full independent-grant/baseline composition, unknown historical definition display,
care view/reply/assignment/live-accept separation, actual conversational AI and
permission-filtered retrieval, reviewed canonical human handoff, gated live
transport/staffing, all 106 routes' content/mode decisions and at least 100 reviewed
cases with a bounded configured-provider evaluation remain required. No provider
capability or real staffed chat is claimed. Full screen-reader, physical devices,
hosted role changes and separate-browser propagation have not been accepted here.
