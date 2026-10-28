# Revision 4 W7: owned transient conversations

27 October 2026. Local batch `feat/allie-conversation-state-20261027`, based on W6
`29f82064`, in the reused home-restoration worktree. No publication, provider call,
production migration, business submission or customer-facing AI enablement.

## Implemented contract

The backend now exposes separate public and authenticated assistant namespaces
under `/api/v1/public/learning/assistant` and `/api/v1/learning/assistant`.
They support list/create/read/clear conversations, idempotent turns and cancellation;
the public namespace also issues an opaque guest session. Strict bodies reject
client history, identity, role, record data and arbitrary page URLs. Public writes
require trusted Origin and guest CSRF; authenticated writes retain existing
authentication, CSRF and current role/MFA/session/permission checks. The existing
catalogue-only release gate still blocks public writes. No commerce is enabled.

Guest cookies are HttpOnly, SameSite=Lax and Secure with a `__Host-` name in
production. Guest and account histories remain separate; there is no automatic
joining at login. Account ownership is bound to current user/session/role through
server HMAC, not browser-supplied ownership. Responses are private/no-store.
The existing same-origin Next rewrite carries API requests; actual hosted cookie
forwarding and browser conversation acceptance remain unverified.

PostgreSQL state is shared across instances. A short advisory transaction lock
serializes state/quota claims; the existing actor locks protect current access.
Provider work runs outside transactions. One pending turn per owner, a configurable
global lease limit, current-state compare-and-set and fresh checks before/after
generation and at finalization prevent stale answers becoming current history.
A shared cancellation record plus periodic recheck attempts to abort upstream work.
Cancellation cannot eliminate already incurred provider usage.

Conversation creation and turns have owner-bound operation IDs. Completed exact
turn replay returns the currently permitted conversation without another model call.
Conflicting, pending, failed or interrupted operations require review before a new
operation. At most three active conversations and ten creates per rolling cooldown
hour are admitted per owner. Guest sessions have an additional ten-creation/hour
IP bucket. Per five-minute cooldown, turns allow three guest or six account claims;
a shared IP/risk bucket admits at most 60 weighted claims (guest weight three,
account weight one). The existing trusted-proxy setting controls canonical IPs.

Each admitted turn reserves 32,000 tokens against an explicitly configured shared
UTC-day ceiling. Failed/cancelled work keeps its reservation. Actual returned usage
is recorded separately. This conservative admission control is not a currency cap,
invoice reconciliation or a claim about unmeasured real-model costs. A provider
project hard limit and bounded evaluation are separate controls.

## Privacy, retention and migration

Forward migration **73**, `20261027003000_assistant_transient_state`, adds only
three assistant tables, two enums, indexes and constraints. Its sole cascade is
assistant conversation → assistant turns; existing business tables are unchanged.
The migration's exact LF bytes are pinned in `.gitattributes` so the tested checksum
survives Windows checkout. Applied migration contents were not changed.

Transcript payloads use the existing AES-GCM/HKDF foundation with a separate
`assistant-context` purpose and authenticated owner/conversation/audience binding.
Only the last bounded six turns are kept in model context. Idle expiry is 15 minutes,
absolute expiry one hour, additionally capped by the current session's expiry.
Clear and access/source changes erase encrypted payloads/results. Logical expiry
immediately denies reads; the bounded general-worker retention job erases expired
payloads and retires assistant metadata after 24 hours. Physical cleanup depends
on a healthy worker. Existing backups follow their own retention policy.
Neither Clear nor local expiry promises deletion at the external provider.

Question/history/result log paths are redacted. Only deliberately entered screened
questions, bounded eligible reviewed passages and eligible recent help context cross
the fixed provider boundary. Screening is limited, not perfect. There are no model
tools, business writes or implicit forwarding. See [data-flow review](learning-threat-model.md).

Runtime defaults remain disabled: `HELP_LEARN_AI_ENABLED=false`, empty key/model,
`ALLIE_AI_DAILY_TOKEN_LIMIT=0`. Enabled operation requires reviewed help, an explicit
key/model/positive budget and production encryption/hash credentials. The current
learning catalogue still advertises `flags.ai=false` until the real UI is connected.
[Owner setup](ALLIE_PROVIDER_SETUP.md) and the masked Windows DPAPI helper prepare
isolated evaluation only; they do not edit app environments or enable/deploy AI.

## Actual verification

- A newly created synthetic native CI database replayed **all 73 migrations**;
  regenerated Prisma 7.10.0 client, schema comparison (**No difference**),
  `db:check` and restricted DML-runtime checks passed. Target identity was verified:
  `127.0.0.1:63888 / allied_allie_state_20261027_500496ac47b6_ci`, separate from
  application/shared/production databases. No application data was reset or copied.
- **36 native HTTP/DB cases passed** in the final run: 13 new conversation cases,
  ten learning and 13 workforce-session cases. They cover guest/account isolation,
  CSRF/Origin/MFA, strict input, encrypted state, replay/conflict, shared concurrent
  claims and budget fallback, cancellation, assignment expiry during generation,
  session revocation, clear/expiry, retention and database constraints. Provider
  responses were mocked through the actual adapter. Business enquiry, complaint,
  support-message, outbox, order and payment counts were unchanged in the public
  positive-turn fixture. No real-provider answer quality is established.
- **139 unit cases across seven files passed**, including 51 provider/core and nine
  new encryption/binding/configuration cases, plus existing identity, environment,
  launch-mode and worker regressions. Backend types, lint and script checks passed.
- OpenAPI **375 paths**, route coverage **439 documented operations plus four
  infrastructure operations**, generated frontend API types and frontend typecheck
  passed. Initial missing CSRF documentation was corrected before acceptance.
- A retention assertion initially assumed its new expired row would be first in a
  one-row batch. Older synthetic expired fixtures were correctly processed first.
  The test now verifies bounded progress across at most ten one-row batches and
  preservation of active payloads; the final 36-case rerun passed without a reset
  or runtime cleanup bypass.
- The Windows setup helper parsed, round-tripped a synthetic key through current-user
  DPAPI and refused to overwrite an existing configuration without changing its
  hash. It made zero provider requests. An initial test-harness queue used the wrong
  PowerShell script scope; only the harness was corrected. No real key was involved.
- Coverage structure remains valid at **106 routes, all 106 awaiting full Revision 4
  acceptance**. Backend conversation acceptance does not complete route learning.
  W5's 87 rendered fixture cases and inspected mobile/desktop screenshots remain
  the unchanged frontend checkpoint; W7 has no new conversation UI/browser evidence.

Small local receipts: `%TEMP%\allied-allie-state-20261027-db`, including fresh
replay/schema, db-check, initial conversation acceptance and final 36-case log.
No two-replica deployment, real signed-in role, physical device, full screen reader,
real-provider latency/quality or 100-case provider evaluation was accepted here.

## Remaining work and release boundary

Finish frontend conversation, accurate AI/privacy notices, stop/reconnect/history
reconciliation and access-change disposal. Finish the >=100 reviewed evaluation
set, bounded configured-provider run, factual-support review and current account
data-control verification. Complete independent workforce policy/history gaps,
all-route learning decisions, editable persisted canonical Customer Care handoff
and staffing/schedule/capacity/shared-transport-gated chat. Contact links are not
durable handoff; none of these code gaps is excused by missing credentials.

Before any rollout reconcile newer release branches, perform the guarded forward
migration workflow, encrypted off-device-backup/restore checks, populated isolated
upgrade rehearsal and target `db:check`. Fresh synthetic replay alone is not a
production preservation or restore rehearsal. W4–W7 are not deployed.

Disk preflight and existing dependencies were reused. No Docker images, installs,
worktrees, profiles or build archives were created. On 27 October the owner approved
deletion of exactly four obsolete `.next/dev` directories, totaling 895,695,897
logical bytes. Processes/clean old worktrees/paths/reparse status were rechecked;
running previews use standalone outputs. Automatic approval review rejected the
native deletion again with **blocked by policy**, before execution. No alternate
removal was attempted; all four remain. C: was approximately **26.93 GiB free**
at the final-check preflight, above the owner's mandatory 20 GiB reserve.
