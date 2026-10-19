# Refund requests — gate 83

Route `/admin/refunds`, including its selected handling workspace. Locally accepted
18 October 2026. Deployment and application-wide acceptance remain open. Next gate:
payment exceptions `/admin/payment-exceptions`.

## Implemented behavior

The actual Allied shell and Quicksand interface now contain a named ordered
breadcrumb, compact status controls, a complete refund queue and one selected
handling pane. Wide layouts place records beside handling; narrow layouts place
handling first with a return-to-records control. Status, cursor history, selected
reference and expanded facts persist in the URL. Selection/disclosure changes do
not refetch the queue. Counts describe only the returned page.

Records retain exact NGN amounts, reasons, provider/authorization/clock facts,
precise Lagos lifecycle times, operator identities and full references in labelled
disclosures. Current safe inspection adds cancellation time and an audit-proven note;
older unavailable notes are not inferred from provider diagnostics. Requests,
approvals, external transfer records and independently confirmed completion remain
distinct. No balance, global total, send-money action or replacement transfer is invented.

Current active Admin/Super Admin may inspect the existing administrator scope.
Delegated Staff needs a live refund capability and matching queue stage. Current
profile confirmation precedes private reads; denied access removes records, prepared
evidence and proposals. Unsupported links, failures, empty pages and stale facts
receive separate treatment. Temporary failures preserve available facts read-only.

The existing decision, transfer and evidence-check forms remain in use. Their page
coordinator rechecks identity, current capabilities, independent operator and the
complete current snapshot before one dispatch. It validates exact decision notes,
money/source/actor facts and the existing transfer/check receipts. Cancellation
preserves fields without new reads and returns focus. A local preflight rejection
clearly states that no change request was sent. Named saved/current/recovery panels
receive focus. An explicit current lookup reuses its validated response rather than
immediately fetching that record again.

Minimal actor/refund/action/timestamp/fingerprint locks survive reload and redact
references on session invalidation. Uncertain outcomes never replay. Current facts
do not prove an original request outcome; clearing a browser lock requires independent
reconciliation and does not cancel a server request. Decision drafts retire only
after exact receipt validation. Bank/evidence forms remain in memory and opt out of
automatic browser drafts; known legacy drafts for those forms are purged for the
current account without reading their values or deleting unrelated drafts.

Private evidence retains trusted-host checks, signed upload metadata/expiry, actual
bytes/checksum verification on the backend, restricted evidence access and separate
requester/approver/transfer/checking operators. Gateway processing never exposes a
manual bank replacement. A transfer record does not send money; independent accepted
checking creates the once-only refund ledger entry.

## Visual fidelity and responsive review

Four production baselines (430/768/1280/1440px) were captured and viewed before fresh
built-in ImageGen desktop/mobile concepts were generated, saved and viewed. The
[specification](work-refunds-oct-concepts/spec.md) records corrections before UI work.
Final comparisons use actual reference dimensions **1435 × 1096** and **1035 × 1520**,
plus the real 430px mobile layout.

| Point                | Final comparison and intentional correction                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell                | Actual Allied logo, account strip and grouped navigation replace generated identities, rewritten mobile branding and decorative device margins. The existing sidebar breakpoint remains authoritative.            |
| Typography and forms | Quicksand 30px/24px headings, 13px body, visible borders, 44px controls and deliberate focus match the accepted interface. Inherited field margins were corrected before production.                              |
| Composition          | A compact queue and one selected pane follow the desktop concept; narrow handling precedes records. Desktop action and disclosure controls share a row without hiding facts.                                      |
| Discovery            | Exact supported status/cursor history and current-page counts replace the invented Page 1 of 1 indicator. Refresh remains secondary.                                                                              |
| Financial facts      | Actual amounts and distinct requested/updated/approved/transferred/checked/processed times replace repeated generated samples. Extreme values and references wrap without clipping or rounding.                   |
| Handling             | A safe default cancellation choice and multiline optional note remain explicit; existing bank/evidence forms show only the current permitted independent step. Read-only explanations name the required operator. |
| States and focus     | Denied/stale/empty/loading, saved/current/uncertain and evidence states have deliberate copy. Modal cancellation focus and locally authored no-dispatch errors were corrected before the production run.          |

## Verification

- **57/57 production browser scenarios pass:** 42 new refund cases and 15 adapted
  refund/delegated/payment regressions. They cover both administrator roles,
  delegated scope and revocation, profile failure, URL paging/selection/disclosures,
  draft/focus preservation, exact decisions, all uncertain receipt variants,
  storage failure, explicit reconciliation, evidence boundaries and transfer/checking.
- **11 frontend unit cases pass:** five refund helpers, three pending/privacy cases
  and three existing refund-processing units. **Four new API/database cases** and
  **two existing delegated workflow regressions** pass. Only the two affected API
  cases were repeated after the earlier cancellation-note provenance refinement.
- **33 final new-page Axe scenarios** pass: seven widths (320, 375, 430, 768, 1024,
  1280, 1440px) plus 26 native/state captures. All have zero serious/critical
  violations and no page overflow or page errors. States include queue/handling,
  empty/failure/profile/Staff/loading, extreme content, gateway/failed/cancelled/
  processing, transfer/evidence, review, pending/saved/current/redacted recovery and
  denied/invalid evidence. Existing transfer coverage also passes at 320–1920px.
- Frontend TypeScript, scoped lint/formatting, the production build and **34 exact
  runtime/source/dependency hashes** pass. A final test-file formatting correction
  was verified whitespace-only and synchronized without rebuilding or repeating
  financial effects. Generated declarations were not formatted. Backend TypeScript,
  lint/formatting and route/OpenAPI checks passed for the foundation: 300 paths,
  354 documented operations plus four infrastructure routes in that workspace.

The connected production Edge → Express → PostgreSQL run confirmed the actual isolated
target before writes: `127.0.0.1:55480 / allied_work_aftercare_20261017_test`, using the
existing restricted runtime. It reused operator, captured-payment and refund fixtures,
adding 19 synthetic requests to exercise actual **25+1 paging/reload/Previous**.

One normally recorded transfer and two committed-lost responses (approval and
independent check) used the actual services and database. **Three UI financial POSTs
produced three refund mutation audits and one NGN100.00 refund DEBIT ledger entry.**
Approval and transfer alone produced no refund ledger. Current reads recovered without
replay; independent reconciliation cleared only browser locks. One evidence object
was uploaded and its actual bytes/SHA-256 checked before transfer recording.
The other 11 refunds, captured payment/attempt/review and customer profile retained
their hashes. This fixture customer had no invoice rows; no invoice mutation request
was sent, and no non-empty invoice preservation claim is made. There were 22 new
privileged refund READ audits, zero page errors and zero temporary sessions remaining.
Super Admin, ungranted Staff, Customer and anonymous boundaries passed.

Storage used an explicitly injected isolated in-memory ObjectStoragePort with actual
PDF bytes, upload headers and hash verification. External S3, off-device encryption,
retention and provider delivery were not tested; those remain deployment checks.
Synthetic evidence explicitly states that no real bank transfer occurred.

## Safety and remaining scope

Gate 82's unchanged 60-migration replay/target/restricted-role evidence was reused.
This gate introduced no schema/migration or existing-grant change. All fixture/session
and financial test effects stayed on the confirmed isolated test database. Existing
and partial synthetic fixtures remain preserved; only owned temporary sessions were
removed. No reset, destructive cleanup, shared/application/staging/production database,
backup/restore, push or deployment operation occurred in this gate. No new restore
rehearsal or off-device recoverability is claimed.

[Backend contract](../../../backend/docs/administrator-refunds.md) records ADM-44's
implemented safe current read and cancellation facts. Durable original decision/
transfer/check receipts remain optional under ADM-45; current facts are not original-
request proof. Payment exceptions, disputes, organisation, remaining role regressions
and deployed verification remain open. The overall goal remains active.

Private evidence under `C:/Users/PC/.codex/`: `work-refunds-browser.log`,
`work-refunds-api-tests.log`, `work-refunds-regression-tests.log`,
`work-refunds-note-tests.log`, `work-refunds-real.json`,
`work-refunds-real-progress.json`, `work-refunds-build.log`,
`work-refunds-captures.json`, `work-refunds-source-hashes.json` and matching captures.
Reviewable tests are `tests/e2e/work-refunds.spec.ts`, the adapted
`refund-processing.spec.ts`/`staff-payments.spec.ts`, both refund unit files and
`backend/tests/integration/work-refunds.test.ts`.
