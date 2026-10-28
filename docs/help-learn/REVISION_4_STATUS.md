# Revision 4 implementation checkpoint

## Current publication checkpoint - 28 October 2026

Committed W1-W15 foundations are now included in production runtime
`a51a58b856e12c0187c1d5753f2f30ef4382a894`, backend
`3ee6748f-ed72-4c89-b9a1-f1963e891190` and frontend
`dpl_5LscxLnZGRXNBorSWq3GFgfUBcGq` on both domains, with 76 forward
migrations. Exact-source GitHub gates, 41 packaged image/spec cases, 47 corrected
hosted Allie/handoff/access/learning cases and 23 public checks per domain passed.
The complete evidence and limits are in
[the consolidated release](../../backend/docs/master-consolidation-release-20261028.md).

Code publication does not enable conversational AI or live human chat. Those flags
remain off; queued reviewed Customer Care is supported. Full Revision 4 remains
incomplete: shared gated live transport/availability/takeover, all 106 exact-route
learning decisions, final bounded real-provider re-evaluation and real-role,
physical-device and full screen-reader acceptance remain. Prior evaluation
allowance remains exhausted (117 actual calls, 120 reservations); no ledger was
reset and no new provider call was made for this release.

The older local-only, pending-publication and migration-72 checkpoints below are
historical evidence of their individual implementation stages. They do not replace
this current publication record or establish acceptance of the remaining scope.

Canonical brief: [Revision 4](REVISION_4_BRIEF.md), read completely on 26 October 2026.
It supersedes the earlier optional-AI completion criterion. The active goal includes
the entire brief, not just the first batch. The owner subsequently authorised deployment of committed W1?W3 batches; unfinished work is not published.

Source: feat/workforce-allie-r4-20261026, reusing the clean release worktree and
verified dependencies at 9b1728fe; live runtime 3ccee21a was checked in the preceding
release. Other worktrees and their uncommitted work remain preserved.

| Dependency / requirements                                                                                                       | Current status                                                                         | Evidence / remaining gate                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reconcile supplied workforce definitions, account tier, position and independent grants                                         | Source inspected                                                                       | Existing WorkforceAccess/WorkforceAssignment, controlled eight-template catalogue plus CEO position; no automatic staffing or grants                                                                                          |
| W1 scoped management directory                                                                                                  | Implemented; bounded isolated checks passed                                            | GET /admin/workforce/accounts, bounded scoped rows and responsibility summaries; existing editor reused; role/position/status/search filters                                                                                  |
| Effective access, provenance, scope, immutable template evolution, atomic promotion/demotion, active sessions and subscriptions | Incomplete                                                                             | Existing transactional scope and 30-second UI revalidation are foundations; complete Revision 4 negative and transition acceptance is still required                                                                          |
| W2 role/delegation dependencies                                                                                                 | Released; hosted fixture acceptance passed; actual-role mutations open                 | Atomic delegation removal and reason/revisions; no dormant authority on invitation acceptance; WORKFORCE_ROLE_DEPENDENCIES_W2.md                                                                                              |
| W3 pinned template/delegation versions and canonical fitment/recipient eligibility                                              | Released at migration 72; hosted fixture acceptance passed; actual-role mutations open | Forward migration 72, fresh replay/schema check, populated reduced fixture; WORKFORCE_TEMPLATE_VERSIONS_W3.md                                                                                                                 |
| W4A responsibility provenance and reviewed assignment/revocation impact                                                         | Implemented locally; isolated integration and rendered fixture acceptance passed       | Scoped added/removed/retained preview, hidden-source redaction, in-transaction impact fingerprint; WORKFORCE_EFFECTIVE_ACCESS_W4.md. Account baseline/independent grants are explicitly outside this partial projection       |
| W5 canonical navigation and active workspace invalidation                                                                       | Implemented locally; native and rendered fixture acceptance passed                     | Shared predicates, owner baseline, stale read/draft/learning/notification disposal and safe redirect; WORKFORCE_NAVIGATION_SESSIONS_W5.md; full policy/chat composition remains open                                          |
| Complete website/dashboard matrix                                                                                               | Baseline recorded; incomplete                                                          | REVISION_4_COVERAGE.json overlays the maintained source inventory; entries remain pending until exact role/state evidence exists                                                                                              |
| W6 server-only conversational provider core                                                                                     | Implemented locally; no exposed conversation route                                     | Actual Responses adapter, bounded eligible retrieval, post-generation access/content checks and validated actions; 51 unit/contract and 10 learning HTTP/DB cases passed with mocked provider. ALLIE_PROVIDER_CORE_W6.md      |
| W7 owned encrypted conversations and shared admission controls                                                                  | Implemented locally; native provider-mocked acceptance passed                          | Migration 73 fresh replay/schema/db:check; 36 native and 139 unit cases; server-owned state, CSRF, shared quotas, replay/cancellation/retention. ALLIE_CONVERSATIONS_W7.md                                                    |
| Canonical conversational retrieval and actual AI provider                                                                       | Implemented and evaluated locally; full journey/hosted gates open                      | W9 real provider baseline/rechecks and actual guest/customer browser composition; W8 UI/W7 state. All routes, reviewed persisted handoff and gated shared transport remain required.                                          |
| All-dashboard reviewed topics, guides and isolated practice                                                                     | Incomplete                                                                             | Preserve current working content; extend and verify per-page decisions and actual task states                                                                                                                                 |
| Reviewed persisted human handoff                                                                                                | W15 implemented locally; native and browser acceptance passed; publication pending      | Canonical records, explicit review/sharing, encrypted recovery and uncertain-result safeguards; REVIEWED_HANDOFF_W15.md. Shared staffed transport remains incomplete                                                                                                                           |
| Gated live transport, availability, takeover and replay                                                                         | Not implemented                                                                        | Staffing, separate support schedule and hosting readiness unverified; do not promise live service                                                                                                                             |
| At least 100 reviewed AI evaluation cases and critical security checks                                                          | W9 bounded checkpoint; limitations explicit                                            | 100 real baseline, ten local negatives, 12 targeted rechecks; 80 focused units and 39 native cases. Baseline quality issues corrected; not a second complete final 100-case run or hosted acceptance. ALLIE_EVALUATION_W9.md. |

Run from backend:

- npm run learning:coverage:check: structural integrity only; reports open coverage.
- npm run learning:coverage:complete: completion gate; must fail while gaps remain.

W1 uses the existing schema and grants. It does not migrate accounts, grant duties,
change a person's tier/position, enroll legacy accounts or send invitations. The
owner baseline and the explicit legacy-enrollment compatibility boundary remain.
Delegated discovery requires current management authority and is limited to Staff
in the owner-approved branch envelope; responsibility summaries exclude definitions
outside the operator's delegation. Active expiry/revocation and invalid scopes grant
nothing. The directory exposes no customer profiles or security credentials.

W1 evidence: [directory implementation and checks](WORKFORCE_DIRECTORY_W1.md).

W2 evidence: [role dependency implementation and checks](WORKFORCE_ROLE_DEPENDENCIES_W2.md).

W3 evidence: [versioned definitions, scope fix and compatibility](WORKFORCE_TEMPLATE_VERSIONS_W3.md).

W4A uses `feat/workforce-effective-access-20261026` in the existing release worktree,
based on evidence commit `24a386c1`. Responsibility provenance and assign/revoke
impact are verified locally. W5 advances the managed navigation and live HTTP
session boundary below; canonical full baseline/independent policy composition and
real chat subscriptions remain incomplete.

W5 follows on `feat/workforce-navigation-policy-20261026`, based on local W4A
commit `76719cc1`. The navigation/page/action registry and HTTP session invalidation
are implemented with explicit remaining boundaries. Baseline/independent-grant
composition, historical unknown definitions, conversational AI and actual chat
subscriptions remain open. See `WORKFORCE_NAVIGATION_SESSIONS_W5.md` for current
evidence; neither W4 nor W5 has been published.

Historical production checkpoint: runtime c4e0005d, backend 707a200f-17c3-4947-a0bd-21b39496cf6a, frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln; both custom domains verified at that release. Full evidence, qualifications and compatible recovery: backend/docs/workforce-versions-production-20261026.md. Other release branches have advanced; recheck live source before any rollout. The full Revision 4 goal remains incomplete.

W6: `feat/allie-provider-core-20261026`, based on W5 `decfabcf`; backend-only provider and retrieval core accepted in isolated tests. No public feature enabled or real model call. Full Revision 4 remains active; see `ALLIE_PROVIDER_CORE_W6.md` for exact unfinished code versus configuration.

W7: `feat/allie-conversation-state-20261027`, based on W6 `29f82064`; owned transient
conversation API, encrypted shared state, bounded retention, quotas and cancellation
accepted locally. Migration 73 was replayed only on a fresh synthetic CI target.
See `ALLIE_CONVERSATIONS_W7.md`, `learning-threat-model.md` and
`ALLIE_PROVIDER_SETUP.md`. The owner could not confirm hosting topology; conservative
multi-instance assumptions are explicit. A masked Windows-user-encrypted setup helper
is available; no real key, model call or app enablement was used in acceptance.
No W4-W7 publication. The full goal, provider evaluation and 106-route gate remain open.

W8: `feat/allie-conversation-ui-20261027`, based on W7 `6cacdfda`; explicit conversation/send, safe sources, stop, uncertain-result checks, clear review, privacy and reviewed fallback accepted locally. 16 distinct browser cases at 320-1440px plus 390x844; 1,109 frontend units, final build, 37 native integrations and 60 provider/state units passed. No real provider call or W4-W8 publication. See `ALLIE_CONVERSATION_UI_W8.md`; all 106 route gates remain open.

W9: `feat/allie-provider-evaluation-20261027`, based on W8 `4bcf3113`. Dedicated
DPAPI provider configuration verified without printing secrets; 100 baseline cases
reviewed (75 accepted without recorded quality issue, 25 needed improvement), ten
local negatives blocked, and 12 targeted real rechecks accepted after source/prompt/
retrieval corrections. Actual guest follow-up and authenticated Customer Care help
verified with real API/CI DB/provider, native-dialog Axe and inspected 390/1440
screenshots. Retention guest-lock ordering fixed; 80 units, 39 native cases, source/
scripts/frontend typechecks and lint passed. No schema or default enablement change.
117 real calls, 120 conservative reservations; no more provider calls under this
approval. See ALLIE_EVALUATION_W9.md and ALLIE_EVALUATION_REVIEW_W9.json. No W4-W9
publication. Full workforce policy/history, all 106 route gates, persisted reviewed
handoff and staffed/shared transport remain open. Next bounded implementation is
canonical Customer Care handoff contracts and backend, preserving existing workspaces.

W10: `feat/workforce-history-policy-20261027`, based on W9 `8b360b89`. Unsupported
read-only workforce history, accurate labels and reviewed old-row revocation receipts
accepted with nine native cases, 1112 frontend units, one optimized build and four
rendered 320-1440px keyboard/Axe fixtures. Current grants and request enums stay
strict; no migration or further provider call. See WORKFORCE_HISTORY_W10.md.
Independent-grant/baseline and granular Care authority remain foundation dependencies
before canonical handoff/shared transport. Full Revision4 and all106 gates stay open.

W11: `feat/workforce-independent-access-20261027`, based on W10 `11c4ac15`. Separate
owner-grant projection, exact HTTP compatibility, existing four independent-duty
workspaces and help/notification/access invalidation accepted locally in57 native,
112 backend unit, full1114/final45 frontend and18+11 browser cases. No grant/role
creation, schema change, model call or publication. See WORKFORCE_INDEPENDENT_ACCESS_W11.md.
BOOKING_CONFIRM/scoped financial aftercare and granular Care duties remain foundation
dependencies; canonical handoff/shared staffed transport and106 route gates stay open.

W12: `feat/workforce-scoped-booking-20261027`, based on W11 `8503f4f7`. Current
BOOKINGS_READ scope plus separate BOOKING_CONFIRM reach a reviewed scoped adapter
using existing business guards. Eleven scoped native, 57 workforce/session/learning,
eleven legacy booking and59 backend unit cases passed; full1121 frontend plus final
34 booking/registry and35 API/review cases passed. Twenty final responsive fixtures
and one actual browser/CSRF/API/restricted-CI-DB confirmation passed with one audit
and one scheduled reminder; no delivery claimed. Source error-code and mobile-label
defects found during rendered acceptance were fixed and rechecked. No migration,
provider call or publication. See WORKFORCE_BOOKING_W12.md. Financial-aftercare
adapter, granular Care duties, canonical persisted handoff, shared staffed/gated
transport and all106 exact route completion decisions remain open.

W13: `feat/workforce-scoped-aftercare-20261027`, based on W12 `e31af199`. Scoped
finance reading AND a separate financial approval duty govern the minimal aftercare
queue/detail/decision. Existing fee/inspection/audit core preserved; no refund/stock
execution. HMAC revision binds reviewed evidence; internal versus customer-visible
notes and uncertain recovery are explicit. Final62 native,60 backend units, full1130
frontend/final67 focused and21 fixture plus1 actual native-browser cases passed.
OpenAPI379/routes443+4, generated types, types/lint/secret guard and cached build pass.
No schema change, model call or publication. See WORKFORCE_AFTERCARE_W13.md. Granular
Care duties, persisted reviewed handoff, shared staffed/gated transport, exact-lock/
hosted/device checks and all106 route completion decisions remain open.

27 October 2026 - Revision4 W14A contact boundary: Staff/Admin mixed-branch
Care authority no longer supplies contacts for a Sales-only case in another branch.
Natural expiry after a blocked record read is rechecked; inaccessible cases fail
closed and legitimate Sales reads remain redacted. Six focused native +57 existing
workforce/session/learning regressions,13 parser units and8 browser fixtures at
390/1440 passed; screenshots inspected with Axe/overflow/no-write assertions.
Source types, changed lint and cached build pass. No schema/model call/publication.
See docs/help-learn/WORKFORCE_CARE_CONTACT_W14A.md. C:25.32GiB free at last check.
Granular Care duties, persisted handoff/shared staffed transport and all106 route
completion gates remain open; fullRevision4/Item6 stays active.

27 October 2026 - Revision4 W14B local foundation checkpoint: immutable version1
retained; reviewed version2 adds independent Care view/reply/assign/live duties.
Business positions now have a separate fixed catalogue; CEO enrolment restriction
remains. Version1 delegated management remains usable and cannot acquire new duties
from unknown historical names. Explicit pinned requests/receipts, current previews,
MFA/password/reason/target/revision safeguards retained. Fixed reason loss on review
while preserving immediate password clearing. 45 native regression +final5 focused
policy cases,51 backend units, full1134 frontend plus29 focused/final12 component,
and8 final responsive fixtures at320/390/768/1440 passed with types/contracts/lint/
secret guard/final cached build. Screens inspected. No schema/provider call or
publication. See docs/help-learn/WORKFORCE_CARE_POLICY_W14B.md. C:25.20GiB measured;
Docker retained after read-only review. Next required: operational Care view/reply/
assign adapters and notification/help predicates before these new journeys are
declared usable, then canonical persisted handoff/shared staffed transport. All106
route completion gates and fullRevision4/Item6 remain active; W9 allowance exhausted.

27 October 2026 - Active Revision4 W14C operational Care adapters, branch
feat/workforce-care-case-adapters-20261027 based on W14B daaa2e2a. Initial8 native
cases reproduced7 missing behaviours; expanded12 now pass. Backend current branch
view/reply/assignment, checked eligible-handler pagination, complaint assignment,
notification recipients/revocation, lock-wait expiry and customer ownership verified.
Separate61 workforce/session/learning regressions pass across12 current templates.
Frontend scope/nav/read-only controls partially implemented;44 focused units pass.
Complaint assignment controls/shared candidates/pending recovery are in progress,
not accepted. New browser fixtures, help predicates, original browser regressions,
contracts/build/final review remain. Existing3167 preview serves W14B only. See
docs/help-learn/WORKFORCE_CARE_CASES_W14C.md. No schema/model call/publication.
FullRevision4, canonical handoff/shared staffed transport and all106 route gates active.

27 October 2026 - Revision4 W14C local checkpoint: operational Care view/reply/assign
intersect on the actual branch. General enquiries and complaints use canonical
reviewed assignment with checked eligible-handler pagination, CAS/audit/notifications.
Read-only controls, current help/practice predicates, public/internal separation,
revocation and reference-only uncertainty recovery implemented; unsent cross-action
drafts retained after verified success. Final14 native+61 regressions,21 backend
units, full1145 frontend/171files+36 focused,36 new responsive and50 legacy browser
cases pass. One real browser/CSRF/API/restricted-CI-DB flow saved2 assignments and
2 public replies,4 audits,zero internal messages,unchanged inventory/bookings.
OpenAPI381/routes445+4,types/lint/secret3260/correctly configured cached build pass.
Screens inspected; synthetic sessions revoked/cookie removed. No schema/provider
call,real delivery or publication. Evidence: docs/help-learn/WORKFORCE_CARE_CASES_W14C.md.
FullRevision4 remains active: next canonical reviewed persisted Allie handoff, then
shared staffed/gated transport and all106 exact route-learning decisions. W9 allowance
exhausted; new Care guidance has no actual-provider re-evaluation. Exact-lock16.4.3,
hosted/actual-role/device/screen-reader gates stay open. Useful Docker/caches retained.

27 October 2026 - Revision4 W15A backend-only checkpoint: reviewed canonical
asynchronous handoff contracts implemented. Current customer identity/CSRF, exact
keyed review, selected owned customer help excerpts, branch/target/version and
24-hour owner/payload-bound receipt. Canonical Enquiry/Complaint/SupportMessage
reuse; atomic audit/notification/context ending, no second inbox or schema change.
Final14 focused native and109 combined legacy/support/Allie/session/Care cases,
70 provider/state/guidance units+51 workforce units, OpenAPI384/routes448+4, types/
lint/secret guard pass. No actual-provider call, real delivery or publication.
Frontend handoff is unfinished; next implement review/edit/cancel/recovery/draft
preservation and responsive/native browser acceptance. Preview3167 is W14C only.
See docs/help-learn/REVIEWED_HANDOFF_W15.md. FullRevision4/shared staffed transport/
all106 route gates remain active; W9 provider allowance stays exhausted.


27 October 2026 - Revision 4 W15 reviewed Customer Care handoff checkpoint: customer review/edit, explicit selected help sharing, canonical new/existing support persistence and encrypted session-bound recovery are implemented locally. Browser storage retains only an operation ID; uncertain results block a new operation, and cancellation preserves a case already saved. AI-off/guest/workforce boundaries and separate drafts remain intact. Accepted evidence: 116 distinct native cases across seven suites (115 broad plus the revised 11-case learning run), 84 Allie backend units, full 1,161 frontend tests in 173 files, 32 distinct browser fixtures and one actual browser/CSRF/API/restricted-CI-DB composition. That composition saved one enquiry and one complaint reply, two audits, preserved an internal note and left inventory/bookings unchanged. OpenAPI 385 paths / 450 operations plus 4 infrastructure routes, generated contracts, types/lint/secret guard and optimized build pass. See docs/help-learn/REVIEWED_HANDOFF_W15.md. No schema, provider call, real delivery or publication. Temporary native sessions revoked/cookie removed; C: measured 23.34 GiB free; useful Docker/cache resources retained. Full Revision 4 remains active: shared staffed/gated transport, operational readiness and all 106 exact-route acceptance decisions remain open. The owner authorised a reviewed committed release before the session limit; reconcile newer live frontend/backend fixes and complete the migration-73/backup/restore/exact-lock/hosted gates before publication.


28 October 2026 - W16 transport discovery checkpoint. The existing customer message
API already provides cursor-based bounded pages, stable message IDs and a five-second
poll recommendation; the current UI does not constitute completed live chat. Two new
native PostgreSQL tests force a transaction started before another saved reply to
write after that reply has already been read, for both enquiries and complaints.
Both pass against unchanged current writers, including cursor retry/deduplication;
the suspected transaction-start timestamp loss did not reproduce, so no ordering
fix was made. This is bounded replay evidence, not presence, takeover, connection,
all-role, hosted or full transport acceptance. Fixture writes were confined to the
verified loopback restricted-runtime a5a0bc5cd2c1_ci database. No external delivery,
provider call or production data write. Release candidate 2d96b1e3 remains separate;
all three exact-source CI gates passed. Full Revision4 and all106 routes remain open.
