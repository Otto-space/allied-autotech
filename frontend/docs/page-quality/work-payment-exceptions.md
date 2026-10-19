# Payment exceptions — gate 84

Route `/admin/payment-exceptions`, including its selected investigation workspace.
Locally accepted 18 October 2026. Deployment and application-wide acceptance remain
open. Next separate gate: payment disputes `/admin/payment-disputes`.

## Implemented behavior

A compact status/type filter strip and chronological queue now sit beside one
investigation workspace. The ink context header, friendly category/status labels,
original summary, precise Lagos detection/update times, latest note and source
disclosure distinguish investigation from financial settlement. Mobile selection
precedes the queue. Counts describe the loaded page only; unavailable balances,
customer details, provider payloads and global totals are never invented.

Supported filters, cursor history and selection persist in the URL. Invalid or
duplicate parameters fail closed. Selection and reference disclosure do not refetch
the queue. Current reads work independently of paging. Available payment and refund
links use their actual supported selection parameters; the dispute destination is
honestly labelled as a queue.

The existing operation action form and mutation review are reused. Current active
Admin/Super Admin access is confirmed before protected reads and again before one
submission. A full current snapshot must still match. OPEN can only enter
INVESTIGATING; only an investigation can become RESOLVED or IGNORED. Each action
requires its exact 3–2000 character note and explicit review. Closed records remain
read-only. Cancelling preserves the note and restores focus without another read.

Full safe receipts are checked against identity, original source references/type/
summary/detection, exact note, proposed state and closing actor/time. Saved receipt
facts update the workspace directly; the queue refreshes without a redundant current
request. A browser draft retires only after this validation. Local preflight failures
explicitly say no change request was sent.

Minimal actor-bound record/status/time/fingerprint locks survive reload. Notes are
excluded from that lock. Session invalidation redacts its references. Unknown outcomes
never replay automatically. Explicit current inspection reuses its validated response;
manual acknowledgement of independent reconciliation clears only the browser lock.
It neither proves the original request outcome nor cancels an earlier server request.
Denied access removes protected facts, proposals and saved/current panels.

## Native visual fidelity

[Audit, specification, prompts, concepts and corrections](work-payment-exceptions-oct-concepts/audit.md)
preceded implementation. Fresh built-in ImageGen references were inspected at native
1469 × 1071 desktop and 1024 × 1536 mobile sizes. The generated unsupported counts,
search, sort, references, logo and note limit were corrected rather than implemented.

Final production viewport PNGs were inspected at 1440 × 1050 and 430 × 1050, with
768px and mobile review/long-content inspection. Private evidence is retained under
`C:/Users/PC/.codex/work-payment-exceptions-*`; originals remain in the image-generation
directory. Measurements are in `work-payment-exceptions-measure.json`.

| Fidelity point                    | Measured production result and accepted correction                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing shell and content frame  | Real Allied shell; desktop content x292, width1112, right margin36. Generated branding was discarded.                                                                               |
| Queue/workspace composition       | Desktop widths447.72/644.28, 20px gutter: approximately41/59. This follows the corrected compact two-column concept.                                                                |
| Mobile ordering and margins       | At430px, selected workspace x16/width398/y533.38; queue y1420.67, after selection. Both outer margins16px.                                                                          |
| Type scale and font               | Computed Quicksand and14px interface base. The accepted shared brand cascade produces30px desktop/24px mobile h1, rather than the provisional28px desktop target.                   |
| Ink context and review accent     | Computed ink `rgb(1,18,26)` header and red `rgb(230,3,1)` review button, with white action text.                                                                                    |
| Form visibility and touch targets | Visible `rgb(167,185,199)` textarea border; mobile note width360px, height94px from the shared form treatment; review control360×44px. Existing focus and invalid styling retained. |
| Operational hierarchy             | Friendly status/category, full original summary and note, wrapped precise source facts; no invented financial statistics or reopening controls.                                     |
| Responsive completion             | Seven checked widths320/375/430/768/1280/1440/1920; no horizontal page overflow. Review is readable with reachable actions; long content remains complete and wraps.                |

## Verification

- **48 distinct production browser scenarios have passing evidence**: 35 new exception
  scenarios and 13 existing operations regressions. The first combined run passed 43/47;
  four old exception fixtures/selectors were adapted to the new profile/current-read/
  selection contract, and their focused rerun passed 4/4. The test-only adaptation
  needed no runtime change. Final review found that a new review or failed current
  lookup could leave earlier recovery facts visible. Those facts and acknowledgement
  now clear before either action. One necessary final build and an affected eight-case
  production rerun passed, including the new regression; unrelated database writes
  and financial flows were not repeated.
- The new scenarios cover roles, current-profile failure/revocation, supported URL
  filters/paging/reload, selection without queue refetch, cancel/draft/focus, validation,
  both terminal decisions, stale preflight, blocked recovery storage, definite conflict,
  lost/wrong receipts, failed recovery, current scope and access denial.
- **Six frontend unit cases** pass for strict record/page/body/receipt boundaries and
  minimal recovery identity/storage/redaction. **Three new API/database scenarios**
  pass, including CSRF/MFA/role boundaries and concurrent terminal updates.
- **21 new-page Axe scans**: five responsive browser cases plus 16 production
  state captures. No serious/critical violation, horizontal overflow or page error.
  Existing terminal-transition regressions also run their 320px WCAG scans. Final
  production native captures at four widths confirmed unchanged layout after the
  recovery-state correction; state captures and unrelated static checks were reused.
- Frontend/backend TypeScript, affected ESLint/oxlint, formatting, the production
  build, OpenAPI validation and route coverage pass. Contract checks report 301 paths,
  355 documented operations and four explicit infrastructure routes.
- **24 frontend source/dependency hashes** match the tested snapshot. The adapted
  legacy test was copied into that snapshot without rebuilding unchanged runtime code.

Connected production Edge/API/PostgreSQL passed one Admin start with committed-response
loss, reload/current inspection/manual reconciliation without replay, and one Super
Admin closure. Exactly **two UI investigation POSTs, two mutation audits and six current
READ audits** occurred. All 38 payments, 38 attempts, 31 refunds, 37 invoices and eight
ledger rows were hashed and unchanged; all other exception rows were unchanged.
Staff/Customer/anonymous boundaries passed, page errors were zero, and all four owned
temporary sessions were removed. This test performed no external provider operation.

## Backend and database boundaries

The [backend contract](../../../backend/docs/administrator-payment-exceptions.md)
documents the new safe audited current read, shared projection/full receipt and private
cache headers. Existing transition checks, CSRF and atomic expected-status/audit write
remain authoritative. Closing an exception never changes a linked financial record.

Writes used only the confirmed restricted isolated target `127.0.0.1:55480`,
`allied_work_aftercare_20261017_test`. Existing 60-migration compatibility evidence was
reused. Synthetic exception fixtures are retained; cleanup removed only owned temporary
sessions. No schema/migration, grant, application/shared database, backup/restore,
off-device backup verification, push or deployment operation ran. No restore rehearsal
or zero-risk claim is made. Original-request durable receipts remain an optional
backend enhancement; current reads are not presented as those receipts.
