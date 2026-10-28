# Revision 4 W6: server-only Allie provider core

27 October 2026. Local branch `feat/allie-provider-core-20261026`, based on W5
`decfabcf`, in the existing restoration worktree. This is a bounded implementation
dependency, not a completed conversational journey or deployment.

## Implemented boundary

The five `backend/src/modules/learning/allie.*.ts` modules implement an actual
OpenAI Responses HTTP adapter, bounded reviewed retrieval, source/action validation
and generation orchestration. The existing public and authenticated learning routes
remain read-only. Their `flags.ai` remains false. No browser/API route exposes the
new library yet; production cannot accidentally invoke it through current routes.

The adapter uses the fixed HTTPS OpenAI endpoint, rejects redirects, requires an
explicit server-supplied key/model and has no guessed/default model. It sends a
strict JSON schema through `text.format`, no tools, no provider conversation ID,
`store:false`, no streaming and no automatic retries. Current defaults are a
20-second timeout (configurable 1–30 seconds), 1,200 output tokens (256–2,000),
24,000 bytes of data input and 65,536 bytes of decoded provider response. A failed,
incomplete, refused, malformed, oversized, tool-call or multiple-message response
does not become an answer. Provider bodies/transport errors are never attached to
the safe error. Internal reasoning is not returned.

This follows the current official [Structured Outputs contract](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
`store:false` does **not** establish zero data retention or special account controls;
provider abuse-monitoring and endpoint rules still apply. See the official
[data controls](https://developers.openai.com/api/docs/guides/your-data).
No provider account's retention settings were inspected or changed.

The orchestrator obtains the current eligible catalogue before generation and
obtains it again after the provider returns. Changed access, publication, content,
availability or cancelled work discards the result. Neither catalogue acquisition
is held open while waiting for the provider. Integration must continue to use the
actual current server identity/session/MFA resolver on both calls.

Retrieval uses current published eligible sources, controlled task aliases and
bounded typo matching. It selects at most four complete passages within 8,000
characters; it never truncates a passage's restriction to fit the budget. Source-set
hashes include actual bodies, versions, availability and action definitions. Up to
six recent turns/8,000 characters support follow-ups. Access/source changes or an
unavailable historical source discard that history. This is an internal continuation
contract: clients must never supply history, source bodies or access keys as authority.

Obvious credential, OTP/recovery, token, private-key, card and account-number input
is rejected before an outbound call without echoing it. Detection is deliberately
limited and cannot promise complete redaction or detection. Normal recovery and
account-help questions remain usable. The provider receives deliberately entered
questions and reviewed passages, not account IDs, exact URLs/query strings, customer
records, support conversations, hidden fields, selected rows, uploads or real drafts.
Security-page conversational capture is suppressed by the context contract.

Model output is plain text. HTML, active/Markdown links, unsafe schemes and obvious
secrets are rejected. Model-supplied source/action IDs must resolve to the retrieved
eligible set; actual labels and destinations come from allowlisted server metadata.
Guide/practice actions require their enabled eligible definitions. The initial
assistant has no operational tools; obvious claims of having sent, queued, approved,
reserved or changed records are rejected. These checks do not prove factual support
for every sentence. Actual answer-quality evaluation is still required.

For public/customers, a validated human action opens the existing Contact/Customer
Care flow. It does **not** persist a reviewed handoff or constitute live chat.
Restricted work guidance has no generated customer-support forwarding action.

## Actual checks

- **51 focused unit/contract cases passed**, including the documented request,
  fixed destination/no redirects, no provider state/tools/retries, errors/refusals,
  byte/time limits, cancellation, reasoning exclusion, source/action forgery,
  unsafe output, ordinary versus sensitive questions, history reset, follow-ups,
  unchanged-version content changes and access loss after generation.
- **10 learning HTTP/DB cases passed** on the existing newly created synthetic
  `127.0.0.1:63888 / allied_workforce_effective_20261026_6970069e210b_ci` target.
  Seven earlier learning cases remain; three new cases verify model-input source
  eligibility across public, customer, all eight responsibility definitions,
  delegated Admin and protected owner, plus actual expiry/session-revocation during
  generation and missing MFA before generation. Actual authenticated HTTP and the
  current database resolver ran; the outbound provider was isolated/mocked.
- Actual host/port/native data directory, `db:check` and restricted DML runtime
  were verified before those tests. The 72-migration replay is the earlier W4
  receipt; W6 has no schema change/migration and did not replay it afresh. No
  application/shared/production database or real business message was changed.
- Backend typecheck and lint passed. The initial unit run exposed a bank-help
  question falsely screened as a number; it was fixed without relaxing number
  detection. A control-character regex lint warning was replaced with explicit
  character-code checks. No frontend source changed in W6, so W5's inspected
  browser evidence and optimized build are the relevant unchanged UI checkpoint.
- Changed-file formatting and the repository secret guard passed (3,180 files).
  Its header-only rule initially flagged the synthetic private-key marker in a
  screening test. That marker is now composed at runtime; there is no key material,
  scanner exclusion or security-rule change. The same 51 tests passed again.

No real provider call ran. Process, user and machine variables and the three known
app environment files were checked for relevant configuration names without printing
values; no key/model was found there. This is a bounded configuration check, not a
search through all personal secrets. The owner was asked for server-only configuration,
model and a bounded test usage limit. No purchase, model selection/benchmark claim,
provider quality score or 100-case evaluation is implied by contract mocks.

## Data flow and threat review in progress

The required service-context questions are pending owner response. The working
assumption is an internet-facing, potentially multi-instance deployment. Only the
current library boundary is implemented; the following exposure controls are release
dependencies, not claims about a finished assistant endpoint.

| Abuse path / asset                                      | Current implemented boundary                                                                                        | Required before exposure                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Caller forges role/context to retrieve staff material   | Existing authenticated learning resolver; no role/context grants; eligibility before retrieval and after generation | Conversation ownership/session binding, strict request schema and current resolver on every turn                                    |
| Old answer survives revocation/account switch           | Current catalogue and actual source-set checked again; old history discarded                                        | Atomic turn completion against current conversation/session state; W5 UI cancellation connected to conversation state               |
| Source/question injection expands tools or destinations | All retrieved data stays in untrusted user input; no tools; strict output and registered actions                    | Adversarial configured-provider cases and reviewed factual-support assessment                                                       |
| Secret/transcript or provider key exposure              | Bounded screening; server-only injected settings; safe errors; no provider bodies/logging in this library           | Encrypted expiring shared server state; request-log redaction review; privacy notice and approved provider configuration            |
| Anonymous abuse, replay or quota exhaustion             | Per-call byte/token/time caps; no auto retries; no exposed route                                                    | Opaque secure anonymous session, CSRF, shared atomic quotas/budget reservations, idempotent claims, concurrency/expiry/cancellation |
| Model invents stock, fitment or successful actions      | Reviewed evidence prompt, validated citations/actions and obvious-operation claim checks                            | At least 100 reviewed cases and actual bounded provider evaluation; manual support/accuracy review                                  |
| AI help silently submits/forwards restricted content    | No operational tools or mutation route; work corpus has no public handoff action                                    | Explicit editable handoff review/consent, durable canonical Customer Care persistence and authorised queue visibility               |

Confidentiality/authority risks would be high if the planned endpoint accepted
client-owned history or skipped current eligibility; it currently has no such entry
point. Public resource-exhaustion risk becomes material on exposure. Contract tests
cannot establish multi-instance quota, ownership, session isolation or live readiness.
This is a provisional data-flow note, not the final threat report awaiting the
service-context clarification.

## Next dependencies and limitations

Implement encrypted bounded server conversations, shared quota/token reservations,
idempotent turn claims and cancellation before wiring the endpoint and existing
Allie interface. Preserve no-transcript localStorage, auth/MFA/CSRF boundaries and
permitted fallback help. Provider settings are not yet wired into application env
configuration; the library's injected settings are not an enabled runtime feature.

Finish the existing workforce policy/history gaps, all 106 routes' exact learning
decisions, reviewed content/mode coverage, the >=100-case evaluation set and actual
provider run. Then complete editable persisted Customer Care handoff and gated shared
chat transport/staffing/capacity/schedule/queue fallback. These are unfinished code
and acceptance work, separate from missing provider configuration. Do not describe
the Contact action as completion of handoff or search as conversational AI.

No W4/W5/W6 deployment, dependency install, worktree copy, Docker build/pull/prune,
data cleanup, provider request or real external message occurred in W6. C: was
approximately 27.10 GiB free after the native run. Existing preview port 3167 remains
listening; it serves the verified W5 frontend, not an enabled W6 chat endpoint.
