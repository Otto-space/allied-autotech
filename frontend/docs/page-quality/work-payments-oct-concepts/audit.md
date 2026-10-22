# Administrator payments audit — gate 80

This pre-implementation audit is retained for comparison. The gate subsequently
passed its [local acceptance](../work-payments.md) on 18 October 2026.

Route `/admin/payments`, audited 18 October 2026 after gate 79 acceptance. This page
includes payment attempts, private manual evidence/decisions and refund requests;
invoices, refund decisions, exceptions and disputes remain separate page gates.

## Inspected baseline

Production baseline screenshots at 430/768/1280/1440px were captured and viewed
before UI edits, including full mobile/desktop continuation. Evidence is retained
outside the application as `C:/Users/PC/.codex/work-payments-baseline-{width}.png`
and matching `-viewport.png` files. The current production snapshot is on port3068.
Synthetic manual pending and captured Paystack attempts were supplied through browser
fixtures; no financial domain writes were performed for the baseline.

None of these four captures overflow horizontally. However, stacked filters occupy
almost the entire first mobile viewport, records are loose paragraphs, nested attempt
sections create large gaps, manual facts/form lack deliberate hierarchy and source
links lack full references. Payment/attempt lifecycle dates omit exact milliseconds;
terminal lifecycle fields and full attempt references are not displayed. Pagination
suggests a numbered page without retained URL state. Form fields are cramped versus
the evidence content and a 1000-character reviewer note uses a single-line input.

## Behavior and backend findings

- Route/backend require Admin/Super Admin; Staff must not issue private finance reads.
  Current FinanceAccess checks session role only. Add current active own-profile
  identity checks, explicit recovery and denial clearing before private requests.
- Supported filters are payment status, provider and exact customer profile UUID,
  plus cursor/limit. Provider means any matching attempt; all attempts remain visible.
  Do not invent text/date/global count or remaining-refundable-balance filters.
- Filters, cursor and original refund retry body/key are component memory only.
  Reload resets filters/history and loses uncertain-operation recovery information.
  Manual uncertain locks are also memory-only. Add durable minimal pending markers;
  explicit current-record reconciliation must not resend or prove original outcomes.
- Current manual submission has no fresh identity/current-payment preflight and
  accepts any successful response without validating decision/note/attempt scope.
  Existing backend compare-and-swap prevents a second terminal decision and enforces
  different submitter/reviewer; preserve these rules and their safe projections.
- Existing manual response includes a full payment but its projection omits exact
  reviewer note. Add a safe scoped staff receipt/current projection if needed to
  validate the saved decision/note; do not expand public/customer projections.
- No staff direct payment read exists. A current authorized read independent of
  paging/status is needed for fresh preflight and current-record reconciliation.
  Add minimal private finance READ audits and no-store responses consistently.
- Existing refund idempotency binds attempt/key and checks body but does not reject
  a different requester replaying that key. Bind recovery to the original actor;
  preserve existing valid retries and no second refund/audit. Do not reinterpret a
  received current/refunded status as money returned by merely requesting a refund.
- Refund response parsing currently accepts any refund-shaped record without exact
  attempt/amount/reason/requester checks. Add complete scoped validation. The server
  retains captured-amount commitments/dispute/policy checks and separation of duties.
- Private evidence uses existing temporary authorized document access with CSRF,
  private audit and configured storage. Preserve expiry/unavailable/error states;
  never expose a permanent object key or raw checksum as a product fact.

No schema/migration/grant change is planned. Reuse unchanged isolated database safety
evidence. Confirm the actual `_test` host/port/database before any future fixtures.
The baseline required no database writes and no new backup/restore or rollout.

## Acceptance boundary

Fresh desktop/mobile concepts and inspected corrections must precede UI changes.
Then verify complete supported filters/history, exact dates/money, multiple attempts,
all sources, private evidence states, manual approval/rejection, refund requests,
fresh preflight, single-flight, exact receipts, reload-persistent uncertainty,
explicit current-read recovery, denied-cache removal and all role boundaries.
Use production browser/responsive/Axe/native comparisons, meaningful units and
focused API/concurrency/real-database evidence. Do not repeat unchanged checks or
format the generated API declaration. Gate 80 is **in progress**, not accepted.
