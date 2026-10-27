# Revision 4 implementation checkpoint

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
| Reviewed persisted human handoff                                                                                                | Not implemented                                                                        | Must reuse canonical Customer Care records and customer/operator pages; model cannot send a message                                                                                                                           |
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
