# W16A shared support availability — local implementation checkpoint

Historical foundation checkpoint. See [W16C](SUPPORT_CHANNEL_DISCOVERY_W16C.md)
for the current implementation, tests and publication boundaries.

This is the availability foundation for Revision 4, not completed human chat.
The application in production still has 76 migrations. The new migration and
contracts below are local, uncommitted work; no production setting or data changed.

## Existing architecture and operational readiness

Canonical Enquiry/Complaint/SupportMessage history, owned customer pages, scoped
Customer Care pages, reviewed public replies and internal notes remain the business
record. Existing HTTP message writes, idempotent receipts and cursor-based pages
are reused; stable-message replay was independently checked in W16 discovery.
Bounded authenticated polling is the proposed transport, avoiding process-local
rooms or a new paid service. Shared database state supports multiple API instances.
No cross-instance lifecycle or hosted reconnect acceptance is claimed yet.

Live mode cannot truthfully be enabled now. No approved live support schedule,
named staffing commitment or verified delivery/transport readiness has been supplied.
Workshop hours are not reused as support coverage. The existing queued handoff is
available independently of these missing operational prerequisites.

## Implemented foundation

- Separate `SUPPORT_LIVE_CHAT_ENABLED`, default false; AI flags remain independent.
- Owner-only, current-MFA, versioned and audited support coverage per active branch:
  explicit Africa/Lagos windows, no overlaps, separate day ranges for overnight
  coverage, and one to five concurrent conversations per agent.
- One shared availability row per operator, bound to the current session and
  branch. Explicit opt-in, a maximum 90-second lease bounded by session expiry,
  and current branch view/reply/live duties are required. Role, position, Admin
  status and an ordinary login do not imply live eligibility.
- Explicit opt-in/session/capacity changes increment a revision. Concurrent tabs
  cannot create extra seats. Heartbeats renew only an unexpired current lease and
  do not increment its revision. A previous session cannot resurrect it.
- Customer availability checks current account, MFA session, duties, active branch,
  support hours and shared active capacity. Current duty/session loss removes
  eligibility. Candidate account revocation during verification does not invalidate
  the unrelated customer's session. Responses omit agent identities, wait estimates
  and queue positions and explicitly retain `queued_customer_care` as the channel.
- Withdrawal remains possible for a currently authenticated operator after duty,
  branch, schedule or feature removal. It does not grant new reply authority.
- Strict private/no-store API contracts, CSRF-protected writes, rate limits,
  canonical OpenAPI/handbook export and generated frontend contracts.

Migration `20261028163000_support_live_availability` adds three tables and one enum;
it does not rewrite existing case/message/account data. Coverage/presence checks
bound capacity, revision and schedule shape. Conversation checks require exactly
one canonical case, complete active assignment, and explicit ended-state metadata.
Live channel state is separate from canonical business status. The historical
assigned-session UUID intentionally has no session foreign key: session retention
must not delete canonical history. Presence itself is transient and session-bound.

## Local evidence

- Fresh isolated loopback `_ci` database: all 77 migrations replayed, representable
  schema diff passed and `db:check` passed. Prisma client regenerated.
- A populated synthetic parent-table forward fixture preserved all 756 rows and
  hashes across six parent tables; all three new tables started empty. This is a
  bounded additive-migration test, not a production backup restore or PITR rehearsal.
- 17 schedule/validation/privacy contract tests passed.
- 20 real HTTP/restricted-runtime PostgreSQL availability tests passed: Customer,
  Staff, Admin and owner boundaries, same-branch capability intersection, CSRF,
  stale revisions, competing tabs, heartbeat renewal, session replacement/expiry,
  revocation during verification, changed duties, after-hours fallback, active
  capacity across branches, inactive branches and direct invalid-write constraints.
- 60 existing Care/session/reviewed-handoff regressions passed. An initial harness
  omitted Help enable flags and failed six help-dependent cases; the corrected
  isolated configuration passed all 60 without changing those application paths.
- Backend and generated frontend types, scoped lint, OpenAPI (389 paths) and actual
  route coverage (456 operations plus four infrastructure routes) checks passed.
  Browser evidence is not claimed for this backend-only foundation.

Small local receipts/logs: `%TEMP%/allied-w16a-availability-20261028-db/`, including
`checks.json`, `empty-77-migration-replay.log`, `availability-integration.log`,
`care-session-handoff-regressions.log` and `populated-forward-fixture.json`.
Only synthetic fixtures were written; no provider call or external message was sent.

## Required continuation and release gates

Implement canonical channel request/claim/transfer/end, requeue on lost eligibility,
current ownership on every operation, scope-bound replay, explicit system events,
human takeover/in-flight AI cancellation, and the customer/staff UI within existing
Care pages. Test lost acknowledgements, concurrency, reconnect, stale responses,
unread/jump-to-latest, public/internal separation, current access loss, keyboard and
responsive behaviour. Availability alone does not complete any of these journeys.

Before publication: finish the bounded implementation, commit compatible migration
and contracts, pass exact-source GitHub checks, verify live source again, perform
fresh guarded backup/migration and a separate populated restore rehearsal, and
prepare a forward-schema-compatible recovery composition. Do not reverse migration
77 or use the old 76-migration checker after it is applied. Current/rollback images
and data stay retained. Enable no live flag without actual staffing and complete
transport/security/delivery acceptance. Final provider evaluation, all 106 exact
route decisions and physical-device/full screen-reader acceptance remain open.

Final read-only provider check: the backend remains ACTIVE on
`3ee6748f-ed72-4c89-b9a1-f1963e891190`. The saved Vercel CLI credential now returns
403/forbidden for the existing project and both domain-management reads. This does
not prove a site outage or an alias change; current frontend alias identity could
not be refreshed. Restore authorised Vercel project access and reconcile live source
before any future promotion. No deployment was attempted for this local batch.
Final C: preflight measured 30.56 GiB free. No new Docker image/container/volume was
created; the 53 retained images and useful caches remain under the retention policy.

Later W16B postflight: the existing CLI refreshed its credential and management
reads returned 200 again. The 403 above is historical, not a remaining login block.
Both domains now resolve to a newer external release; see
[W16B source/deployment reconciliation](SUPPORT_CHANNEL_LIFECYCLE_W16B.md).
