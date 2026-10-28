# W16B canonical channel lifecycle — local server checkpoint

Superseded locally by [W16C discovery/recovery and Care UI continuation](SUPPORT_CHANNEL_DISCOVERY_W16C.md).
The remaining-work list below records this earlier checkpoint. Queue/candidates,
reload recovery and the quiet worker have since been implemented and tested natively;
rendered/hosted acceptance and release requirements remain distinct.

This extends [W16A availability](SUPPORT_LIVE_FOUNDATION_W16A.md). It is uncommitted,
unpublished implementation in the existing authoritative worktree, not completed
live-chat acceptance. Production remains on the prior runtime and 76 migrations;
the new additive migration remains local. No feature was enabled or real message
sent. The complete Revision 4 goal remains active.

## Implemented and verified server behaviour

- A current verified customer explicitly selects one owned Enquiry or Complaint.
  The request creates/reopens one related SupportConversation, never another case
  or inbox. Existing canonical status and business assignee remain unchanged.
  Queued requests work while live mode is off. Closed cases reject new requests.
- Shared channel state is QUEUED, HUMAN_ACTIVE or ENDED, independent of the case's
  business status. State/history/audit/reference receipts commit together. Generic
  SYSTEM timeline entries have no user author; accountability stays in the audit
  log, preserving the existing database author constraint.
- Claims serialize against duty changes and other capacity/claim operations. They
  require current same-branch view/reply/live duties, fresh opted-in session presence,
  support hours and shared capacity. Competing agents cannot claim the same channel;
  competing cases cannot exceed the same agent's shared capacity.
- Transfer requires the separate current case-assignment duty and another currently
  eligible, opted-in representative. A live duty alone does not grant reassignment.
  Transfer reason remains in audit metadata, never customer timeline or projections.
- The owning customer, current joined agent, or permitted case assigner can end the
  channel. Another live agent cannot end it. Ordinary case history/follow-up remains.
- Current reads reconcile lost session/duty/lease/availability/coverage into the same
  scoped queue. Closed cases end queued or active channels. Repeated reads do not
  duplicate system entries. Capacity checks also release the actor's stale joined
  channels before another claim. Claim affordances check current availability too.
- Every read/replay/action rechecks current identity and canonical ownership/scope.
  Responses contain state/reference metadata, not transcript, contact details,
  internal notes, staff user IDs or session IDs. Existing message/replay endpoints
  remain the text path, with customer/public visibility filtering at source.
- Canonical support reference-only submission receipts are reused with a distinct
  actor/action scope and exact normalized input binding. Original-key/body replay
  returns current authorised state without a duplicate command or timeline entry.
  Replay reports that the original operation was saved; current state may have
  subsequently changed. Different channels/payloads and expired keys conflict.
- Reload/reconnect can look up state through an authorised canonical case and its
  resulting current version; a browser-held channel UUID is not required.
- An explicitly chosen current-session AI context can be closed without exporting
  text, even when AI/help is off. Pending work is cancelled in shared state; existing
  provider cancellation checks/final version guards reject delayed completion.
  Another customer/session cannot close the context. Failed channel persistence
  rolls back AI closure and history together. Separate AI help is not auto-closed.

The transport contract recommends five-second bounded polling. This checkpoint
implements state endpoints; it does not claim a new rendered polling interface.
Existing canonical public replies/internal notes and the preserved Care pages are
not replaced by a second chat-message writer.

## Evidence

- Restricted-runtime real HTTP/PostgreSQL channel acceptance: 23 tests pass,
  including Enquiry and Complaint request/replay, competing claims/capacity,
  transfer restrictions, case ownership, CSRF, strict payloads, foreign-session
  AI proof, end/reopen, current claim affordances, case-based recovery, four lost-
  eligibility modes, failed-audit rollback and actual delayed mocked-provider
  completion through the existing Allie API.
- Current availability regression: all 20 tests pass after lifecycle integration.
- Existing Care/session/handoff regressions: all 60 tests pass. The final case-lookup
  route addition was then checked by the 23-case channel run and route verifier;
  the 60-case suite was not repeated for that additive lookup alone.
- Existing 77-migration empty replay, schema check, generated Prisma client and
  populated additive-forward evidence remain valid; no migration changed in W16B.
- Final backend and generated frontend typechecks, scoped lint and formatting pass.
  Canonical OpenAPI (396 paths) and mounted-route checks pass with 463 documented
  operations plus four infrastructure routes.

Initial tests exposed a genuine system-author write error; fixed the writer without
weakening the database constraint. A closure fixture initially omitted required
resolution metadata and was corrected. The expanded suite reached the shared
test IP limit; isolated test applications now preserve the real application limits.
Those failures are not represented as successful application acceptance.

Evidence remains outside Git in `%TEMP%/allied-w16a-availability-20261028-db/`:
`channel-lifecycle-integration.log`, `availability-integration.log`,
`care-session-handoff-regressions.log`, the accepted 22-case checkpoint, and final
`checks.json`. Only synthetic data and an injected fake provider were used. No
actual OpenAI request, spending-ledger reset or external delivery occurred.

## Remaining work before journey completion

1. Implement incoming queue discovery/pagination, eligible transfer candidates,
   and explicit pending-operation recovery after reload without persisting private
   transfer reasons. Current original-body receipt replay alone is insufficient
   when that body is lost. Do not infer failure from a missing receipt.
2. Add explicit availability/coverage controls and channel state/actions to existing
   Care pages, with current-access invalidation and existing forms/drafts preserved.
   Integrate human selection into Allie/handoff without forwarding extra transcript.
3. Complete customer/staff polling, missed/duplicate events, offline/backoff/reconnect,
   new-message/unread and jump-to-latest behaviour. Test real browser/API composition,
   role subsets, keyboard, focus, small screens and reduced motion.
4. Add bounded operational reconciliation for quiet channels and verify access-
   change hooks. Current requeueing occurs on authorised channel reads and stale
   capacity checks, not an independently running lifecycle worker. Do not promise
   immediate background transfer merely from this implementation.
5. Verify multi-instance behaviour, proxy/deploy reconnect, load/backpressure and
   staffing/coverage. No staffed live mode or hosted chat readiness is established.
6. Complete exact-source CI, fresh production backup/restore/forward-migration and
   compatible recovery gates for any publication. The existing Vercel CLI refreshed
   its expired credential and restored management API access; no new login is needed.
   Reconcile source before promotion. Live and AI flags stay off. Final provider
   evaluation and all 106 route decisions remain open.

## Concurrent source and release reconciliation

Another session fast-forwarded the authoritative master checkout through notification
runtime `2725efea` to documentation head `6e9d5978`. Incoming changes were notification
UI/tests/docs; no backend runtime change overlapped this batch. The final frontend
typecheck includes that source. Twenty local chat source hashes remained unchanged.
Chat application edits were not stashed, reset or discarded. Small hash/base receipts
are retained. A named tracker-only recovery stash was subsequently retained during
the fitment fast-forward; both append-only document blocks were restored together.

After CLI credential refresh, fresh management reads verified both domains on READY
`dpl_DfQ8TmtFujaCL215HnWRuaTRuRZr`, source
`8d2dfd69041f68bb6ba392351f6b6a76534b7afe`, a newer external fitment release.
Reviewed that source's fitment changes and verified its three exact-source GitHub
checks (40770274274, 40770274308, 40770274264). Master was fast-forwarded and pushed
to `8d2dfd69` without force. All 20 local chat source hashes remained unchanged; the
tracker recovery stash is `202175ae664a794255ee3c4863aedd5b425a1619`. Native Git
stash handling resolved an earlier local tracker/index refusal; no record was lost.
This incorporates the deployed fitment/notification changes rather than overwriting
them. Frontend typecheck also passed after that fast-forward, including the local
generated channel contracts. Recheck provider/source state again before any later
chat publication. Final disk preflight measured 30.35 GiB free on C:.
The backend was separately last verified ACTIVE on `3ee6748f-ed72-4c89-b9a1-f1963e891190`.
No chat deployment was made. Source/alias verification is not rendered acceptance.
