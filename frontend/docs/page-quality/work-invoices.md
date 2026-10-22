# Administrator invoices — gate 81

Route `/admin/invoices`, including its existing inline draft creation. Locally accepted
18 October 2026. The invoice detail route `/admin/invoices/[invoiceId]` is the next
separate gate. Local acceptance does not establish deployed or application-wide acceptance.

## Implemented behavior

The existing Allied shell and Quicksand interface now contain ordered breadcrumbs,
compact grouped filters, a complete invoice list and a deliberate draft workspace.
Exact invoice number, status, branch (including inactive branches), customer profile
reference and source type/reference use supported server predicates. Filters, cursor
history, expanded filters, creation and expanded record state persist in the URL;
UI-only parameters are never forwarded to the API. Counts describe the current page.

Desktop records show invoice/source/branch context, status, exact NGN value and due
date. Narrow records place value and status before labelled source/due facts and
accessible Details/View invoice controls. Expanded facts retain every returned
reference, version, subtotal, tax, deposit credit, total, lifecycle timestamp and
linked payment record. Exact timestamps remain available in Details. Invoice value
is never presented as collected money or a computed remaining balance.

Admin and Super Admin must have a matching active own profile before protected
discovery. Denial removes the list and creation workspace, redacts pending markers
and clears the scoped draft. Explicit access refresh can re-establish access.
Temporary list failure retains labelled previous facts and disables creation/paging.
Staff has no invoice controls or private invoice reads.

The source picker uses the new minimal private collection, debounced literal prefix
or exact UUID search, server paging and independent off-page selection lookup. It
does not fetch customer contacts or prices to select a source. Existing source
invoices block another draft review. Confirmation identifies the actual source,
branch/reference and optional Lagos due date without promising an invented price.

Fresh active identity, an exact current-source invoice lookup and a fresh minimal
source snapshot precede single-flight dispatch. The server retains pricing, finance
policy, deposit/refund checks, source locking, document snapshots and atomic audits.
Returned source/branch/due instant, DRAFT/version0 lifecycle and exact arithmetic
must match before success. A saved result receives focus and links to the actual
draft; creating it does not issue an invoice or collect a payment. Cancelling a
review preserves fields/opener focus and does not refresh the list.

Minimal actor/role/source/fingerprint markers survive uncertain results and reload.
No uncertain request is replayed. Explicit Load current source invoice performs a
new authorized read; its result does not prove the original request's outcome.
Absence cannot establish that an in-flight creation failed. Redacted references
require manual inspection and independent reconciliation. Clearing a reconciled
local draft does not cancel a server request. Durable original-request receipts
remain optional backend work in ADM-41.

## Design and fidelity

[Audit](work-invoices-oct-concepts/audit.md), [specification](work-invoices-oct-concepts/spec.md)
and [exact prompts](work-invoices-oct-concepts/prompts.md) precede implementation.
Fresh desktop/mobile built-in ImageGen concepts were generated and viewed before UI
edits. Native PNG dimensions were measured: **1457×1080** and **875×1798**. Matching
production viewport captures and actual 320–1440px checks were inspected.

| Point                | Final disposition                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and brand      | Actual Allied logo, existing ink navigation/account strip and Find a page search replace generated branding and unsupported account search.                                                                   |
| Typography and forms | Quicksand, 30px wide/24px narrow heading, 13px body, visible borders, at least 44px controls and deliberate focus treatment follow the accepted dashboard system.                                             |
| Composition          | Filters precede optional creation; numbered guidance sits beside source/due fields on desktop and before them on mobile. Full selected references require more height than the generated abbreviated example. |
| Discovery            | Exact supported filters, current-page counts and real cursor history replace invented global totals or numbered pages. Draft creation stays collapsed during normal discovery.                                |
| Records              | Source/branch and invoice value remain distinct. Desktop reserves room for large exact amounts; mobile records retain labelled facts and separate Details/View invoice controls.                              |
| Data and copy        | Actual UUIDs, NGN figures and returned dates replace changed generated examples. Creating, issuing, paying and current-read reconciliation remain separate actions.                                           |
| States and focus     | Distinct empty/failure/access states and focused saved/uncertain/current panels retain truthful outcomes. Broken ARIA references after denial were corrected and rescanned.                                   |

## Verification

- **40 distinct production browser scenarios have passing evidence:** 33 new invoice
  cases and seven adapted existing invoice/payment/detail regressions. The combined
  initial run passed 34; four legacy selectors needed explicit scopes after the
  redesign, one invalid-link selector needed the main landmark, and one 768px test's
  artifact cleanup collided with another CLI run. Those affected cases passed in
  focused continuations. Passing cases were not repeated merely to obtain a clean
  combined count. Final focused acceptance passed **16/16**, including both admin
  roles, three source creations, access denial, malformed-link recovery and all seven
  widths. CLI output directories were isolated for the continuation.
- **Six unit cases** pass: supported query/scope boundaries, strict source projection,
  page order/duplicates, exact draft receipts, large integer arithmetic and account-
  bound pending storage/redaction/clearing.
- **Six API/database scenarios** pass: minimal 25+3 source paging/restoration, literal
  search and eligibility, role/MFA/CSRF/query boundaries, exact invoice discovery and
  private audits, three server-priced source kinds, and concurrent duplicate creation.
- **25 responsive/state Axe scenarios:** seven widths (320, 375, 430, 768, 1024, 1280,
  1440px) plus 18 native/state captures. All have zero serious/critical violations and
  no page overflow. Captures include loading, empty, failure, profile failure, Staff,
  advanced filters, long narrow/wide records, review, saved, pending, current lookup,
  redacted recovery and denied source access. Captured states have no page errors.
- Frontend/backend TypeScript, scoped lint/formatting, production builds, generated
  API types and OpenAPI/route validation pass. Coverage is **274 paths / 327 documented
  operations**, plus four explicit infrastructure operations. The second production
  build incorporates the denied-control ARIA correction and wider exact-money column;
  subsequent CSS formatting changes whitespace only. **26 source/dependency hashes**
  match the final runtime source snapshot.

The connected production Edge → Express → PostgreSQL run verified the actual isolated
target before writes: `127.0.0.1:55480 / allied_work_aftercare_20261017_test`, using the
existing restricted runtime credentials. It reused API identities/catalogue fixtures
and created two additional synthetic item-backed orders for real UI acceptance.

The real flow passed 25+6 invoice paging/reload, source search/selection, cancellation,
one normally confirmed draft and one committed-lost-response draft recovered by an
explicit current read. **Two UI POSTs produced two drafts and two CREATE audits, with
zero payment rows.** There were 21 new administrator invoice READ audits. Hash checks
preserved the original 31 invoices/payment relations and customer profile. Super Admin,
Staff, customer draft privacy and anonymous boundaries passed, with zero page errors
and zero temporary sessions remaining. Financial writes were not repeated for the
later presentation/ARIA refinement; final production browser checks cover that refinement.

Private local evidence is retained under `C:/Users/PC/.codex/`:
`work-invoices-api-tests.log`, `work-invoices-api-fixtures.json`,
`work-invoices-real.json`, `work-invoices-real-progress.json`,
`work-invoices-build.log`, `work-invoices-captures.json`,
`work-invoices-source-hashes.json` and matching `work-invoices-*-viewport.png`/full
captures. Commands/tests are reviewable in `tests/e2e/work-invoices.spec.ts`,
`tests/e2e/invoices.spec.ts`, `tests/unit/work-invoices.test.ts` and
`backend/tests/integration/work-invoices.test.ts`.

## Database safety and remaining scope

Existing migration replay/database verification and restricted-role evidence from
the accepted prior gate were reused because schema, migrations and privileges did
not change. This gate performed guarded isolated synthetic fixture/session writes
and API effects only. Existing and partial synthetic fixtures were preserved.
No application/shared/staging/production database was written; no reset, destructive
cleanup, grant change, migration, backup/restore, push or deployment was performed.
No new restore rehearsal is claimed. Deployment must verify its actual target and
release compatible backend/generated contracts with the frontend.

[Backend contract](../../../backend/docs/administrator-invoices.md) documents the
implemented read/search additions. Durable actor/source/body-bound original-request
receipts remain optional; independent invoice detail, other finance, organisation,
role-wide regression and deployed verification remain open. Next gate: invoice detail.
