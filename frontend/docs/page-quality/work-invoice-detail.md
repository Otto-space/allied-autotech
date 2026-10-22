# Administrator invoice detail — gate 82

Route `/admin/invoices/[invoiceId]`. Locally accepted 18 October 2026. This is a
separate milestone from invoice discovery/creation. Deployment and application-wide
acceptance remain open. Next gate: administrator refund requests `/admin/refunds`.

## Implemented behavior

The actual Allied shell and Quicksand interface contain an ordered named breadcrumb,
compact heading/status, a complete invoice paper and a value/lifecycle/handling rail.
Mobile places value, handling and source before the paper, with labelled narrow line
records and complete lifecycle/reference disclosures. Snapshot issuer, bill-to,
source/branch, line prices/quantities, recorded discount/delivery, subtotal, tax,
deposit credit, total, NGN and precise Lagos dates remain available. Legacy summaries
and reconciled source records state their limits. Drafts and voids are clearly marked.
Payment requests and confirmed receipt records remain separate; no balance is invented.

Current active Admin/Super Admin identity gates protected reads. Strict parsing binds
the invoice UUID and checks document source, version/status, money, lifecycle and
linked payment facts. Missing, malformed, stale and denied documents receive distinct
handling. Stale/unavailable paper disables export while supported metadata actions
remain available. Denial removes protected facts and proposals.

Issue/void use fresh identity/current-invoice preflight, a full reviewed snapshot,
expectedVersion, single-flight dispatch and exact immutable/lifecycle receipt checks.
Cancellation makes no extra read and returns focus. Successful results focus their
named receipt. Minimal actor/invoice/action/version/fingerprint markers survive reload;
uncertain outcomes never replay. Explicit current lookup does not prove the original
request's outcome. Clearing its browser lock requires independent reconciliation.

New private staff document/PDF endpoints reuse customer snapshot/receipt construction
and the existing renderer. Draft PDFs warn on every page. Downloads require expected
version/status, bounded PDF content and matching identity/type/lifecycle headers;
fresh access and invoice checks occur before and after preparation. Native sharing
or download/copy-private-page fallback uses the actual administrator route. The link
does not grant access. Shared dialog styles now belong to DocumentActions, and its
StrictMode cleanup preserves connected dialogs while restoring focus on removal.
Customer invoice/receipt defaults remain compatible.

## Visual fidelity and responsive review

Four baseline widths (430/768/1280/1440px) were inspected before fresh built-in
ImageGen desktop/mobile concepts were generated and viewed. The [specification](work-invoice-detail-oct-concepts/spec.md)
records corrections before implementation. Final browser captures use each reference's
actual native dimensions: **1435 × 1096** and **878 × 1790**, plus actual 430px mobile.

| Point                | Final comparison and intentional correction                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand and navigation | Actual Allied logo, grouped navigation, account strip and page search replace generated navigation and invented identity.                                                                                                    |
| Hierarchy            | Named three-level breadcrumb, 30px/24px Quicksand title and compact secondary refresh controls preserve the intended density.                                                                                                |
| Composition          | Wide invoice paper and dark value/lifecycle rail follow the desktop concept; narrow layouts deliberately put handling/source ahead of paper.                                                                                 |
| Paper                | Red top rule, issuer/bill-to/source, draft stamp, line grid and aligned totals follow the concept; real recorded dates, tax and document basis replace generated examples.                                                   |
| Exact facts          | Full references, updated/voided timestamps, version and exact NGN amounts remain accessible. Extreme values wrap without clipping or rounding.                                                                               |
| Controls             | Issue remains primary, void reviewed secondary; native sharing and private-link fallback retain visible borders, focus and 44px controls. Sharing styles were moved out of the customer-only stylesheet after visual review. |
| States               | Stale paper, access failure, saved/current/uncertain outcomes and legacy records have deliberate copy and focused recovery. A low-contrast redundant dark-summary sentence was removed before final acceptance.              |

## Verification

- **51 distinct production browser scenarios have passing evidence:** 36 new detail
  cases, seven adapted invoice/list/payment regressions and eight shared customer
  PDF/receipt/share regressions. The main production run passed **43/43**; after the
  shared stylesheet move, **12/12** focused export/share/width checks passed. Previously
  passing financial flows were not repeated for that presentation-only change.
- **Six new helper units** and six existing invoice units pass. **Five new isolated
  API/database scenarios** and **24 existing financial-document regressions** pass.
  These cover private exact documents/audits, roles/MFA/query boundaries, actual draft
  PDFs, issue/void/customer projection, stale download rejection and competing transitions.
- **30 responsive/state Axe scenarios:** seven widths (320, 375, 430, 768, 1024, 1280,
  1440px) plus 23 native/state captures, all with zero serious/critical violations
  and page overflow. Captures include all four statuses, legacy, paper failure/staleness,
  failed/missing/loading reads, profile failure, Staff, extreme narrow/wide content,
  review, saved, pending/current/redacted recovery, sharing and rejected PDF headers.
  Captured states have zero page errors. Final sharing/native captures were viewed.
- Frontend TypeScript, scoped lint/formatting, production builds and **30 matching
  runtime/source/dependency hashes** pass. Backend TypeScript, lint, formatting and
  route/OpenAPI checks passed for the document foundation (276 paths/329 documented
  operations plus four infrastructure operations at that phase). Later workforce
  additions are outside that API-count boundary. Generated declarations were not formatted.

The connected production Edge → Express → PostgreSQL run reused the first preserved
gate82 draft and confirmed `127.0.0.1:55480 / allied_work_aftercare_20261017_test` before
session writes. It verified a real draft preview/PDF/private sharing link, cancel/focus,
one exact issue, stale draft-download rejection, one committed-lost-response void,
reload and current-read recovery without replay. **Two UI POSTs produced two
STATUS_CHANGE audits, zero payment rows and 16 new administrator invoice READ audits.**
The other 35 invoices/payment relations and customer profile retained their hashes.
Super Admin, Staff, customer draft/document privacy and anonymous boundaries passed,
with zero page errors and zero temporary sessions remaining.

## Database compatibility and remaining scope

During connected verification, newly committed workforce session code queried a table
absent from the preserved 59-migration test database. The initial attempts stopped
before financial writes and removed their temporary sessions. The committed additive
`20261018140000_workforce_access` migration was reviewed and all **60 migrations**
replayed on a newly created empty isolated test database. The existing isolated target
then passed the backup-protected `npm run db:migrate` and `npm run db:check`; client
generation passed and existing row counts/hashes were preserved. Two SELECT-only
grants on the new empty workforce tables were reviewed for the restricted test runtime;
existing grants were preserved, with no new TRUNCATE or administrator privileges.

This compatibility step applied an existing committed migration; gate82 introduced
no schema/migration file. A fresh local dump/archive receipt was verified by the runner.
No restore rehearsal or off-device recoverability is claimed. No application/shared/
staging/production database, destructive cleanup, push or deployment was performed.
Synthetic financial fixtures remain preserved. Financial writes were not repeated
after the final shared-dialog styling correction.

[Backend contract](../../../backend/docs/administrator-invoice-detail.md) documents
the implemented document endpoints. Durable original issue/void request receipts
remain optional: current facts cannot prove an original outcome. Refunds, exceptions,
disputes, organisation, remaining role regressions and deployed verification remain open.

Private evidence under `C:/Users/PC/.codex/`: `work-invoice-detail-browser.log`,
`work-invoice-detail-final-browser.log`, `work-invoice-detail-api-tests.log`,
`work-invoice-detail-real.json`, `work-invoice-detail-real-progress.json`,
`work-invoice-detail-db-compat.json`, `work-invoice-detail-db-*.log`,
`work-invoice-detail-build.log`, `work-invoice-detail-captures.json`,
`work-invoice-detail-source-hashes.json` and matching PDF/PNG captures. Reviewable
tests: `tests/e2e/work-invoice-detail.spec.ts`, `tests/e2e/invoices.spec.ts`,
`tests/unit/work-invoice-detail.test.ts` and backend integration tests of the same name.
