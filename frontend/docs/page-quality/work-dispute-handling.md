# Dispute work queue

Route: `/admin/payment-disputes/work`. Locally accepted on 18 October 2026 as gate **86**; the overall application goal remains active.

## Implemented behavior

A compact queue separates discovery from a current-record handling workspace. The history filter, cursor trail and selected dispute survive reload and browser history. Selection does not refetch the queue. The workspace fetches a current dispute independently, including records outside the loaded page. Closed history remains readable, with authorized evidence access and no mutation forms.

Access requires an active matching current profile and `DISPUTE_MANAGE`, including for administrators. Staff is restricted to primary/backup assignments. Administrators can choose two eligible operators through a bounded searchable lookup; the server independently validates both accounts. Permission denial clears protected records, proposed changes and private evidence state.

Existing assignment, acknowledgement, evidence preservation and provider receipt forms now share a fresh-profile/current-record preflight, conditional writes, full action-specific receipt validation and focused review feedback. Safe drafts remain mounted when the workspace closes. Cancellation restores focus; verified success retires only the completed action's draft. A minimal actor-bound persistent marker locks uncertain writes through reload. Recovery requires a fresh current read and explicit independent reconciliation, never automatic replay. Starting another review or current lookup clears earlier recovery facts.

Private upload tokens, files and signed links stay in memory. Original evidence is preserved, and access uses an audited short-lived trusted-host link. Provider observations and exact monetary values remain distinct from internal handling progress. Acknowledgement and submission notes remain audit-only: a recovery read cannot prove that the original request or note was recorded. The provider determines the financial outcome.

## Design evidence

Four production baselines at 430, 768, 1280 and 1440 preceded fresh built-in ImageGen [desktop](work-dispute-handling-oct-concepts/desktop.png) and [mobile](work-dispute-handling-oct-concepts/mobile.png) concepts. Both were inspected at native size. The [audit](work-dispute-handling-oct-concepts/audit.md), [specification](work-dispute-handling-oct-concepts/spec.md), [exact prompts](work-dispute-handling-oct-concepts/prompts.md) and [corrections](work-dispute-handling-oct-concepts/corrections.md) retain the decisions.

| Comparison                | Implementation evidence                                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and typography      | Actual Allied shell and Quicksand; 30px desktop / 24px mobile heading, 14px body. Main content starts at x292 with width1112 at1440, and x16 with width398 at430.                                                                               |
| Queue hierarchy           | Ruled provider/reference/status, exact amount, response deadline and assignment rows replace repeated full records. Selected rows use a restrained tint and red left rule. Laptop width1280 retains the comparison grid after final inspection. |
| Mobile density            | Two176.5px fact tracks with12px gap at430; references and maximum money wrap without clipping. Forms stack and the selected heading receives focus/scroll.                                                                                      |
| Controls                  | History select is280×48px desktop and368×48px mobile, with16px text and visible border. Assignment uses12/16px field gaps; notes retain the established132px height for up to2000 characters.                                                   |
| Workspace                 | Identity and essential money/assignment facts lead into lifecycle/provider disclosure and focused forms. Inherited nested form cards and excessive margins were removed. Duplicate identity facts were removed from the lifecycle disclosure.   |
| Financial meaning         | Maximum bigint renders exactly as ₦92,233,720,368,547,758.07 with no strikethrough. Native long-reference/large-money captures at430 and1440 were inspected. No refund or provider acceptance is inferred.                                      |
| Review and state fidelity | Native production desktop/mobile/tablet/laptop, mobile review and expanded lifecycle captures were inspected. Empty, failed, denied, uncertain and closed states use the same visual system.                                                    |

## Verification

- Initial production suite: **37/37 browser scenarios passed**, comprising23 new cases and14 updated legacy cases. This includes live profile boundaries, assignment IDs, exact provider receipts, draft retention, keyboard cancellation/success focus, conditional preflight, session invalidation, lost-response reload/reconciliation, history/paging, denied evidence hosts, immutable history and responsive layout.
- Final affected checks passed **10/10**, covering the laptop layout, assignment/progress flows, seven responsive widths and an additional regression preventing an old recovery read from unlocking a later uncertain action. There are **38 distinct passing production browser cases** across the initial and focused final runs. Unchanged backend mutation workflows were not repeated for this presentation change.
- **Five frontend unit cases passed**: URL/scope/private-field/receipt boundaries and minimal actor-bound recovery storage, including corruption/redaction/account change.
- **Three API/database cases passed** for current-read scope, bounded eligible search/paging, private caching, safe DTOs, minimal audits, strict queries, current roles/capabilities, stale writes, immutable history and financial preservation.
- Seven responsive Axe checks at320/375/430/768/1280/1440/1920 plus eight production state scans passed with no serious/critical violations, overflow or page errors: **15 distinct new-page scans**. Legacy checks additionally cover eleven widths including landscape844×390 and two WCAG scans. The affected expanded-state Axe scan and native screenshot were rechecked after removing duplicate facts.
- Production build, frontend/backend type checks, affected ESLint/oxlint and OpenAPI/route verification passed. Contract inventory:303 paths,357 documented operations plus4 infrastructure routes. **28 frontend source/dependency hashes** match the tested snapshot, including final test-only updates copied without another runtime rebuild.

Connected production Edge/API/PostgreSQL verified a committed assignment with lost response, reload/current reconciliation without replay, assigned-Staff acknowledgement, one actual byte/hash-verified evidence upload, original evidence attachment, provider receipt and audited evidence link. There were **four mutation POSTs/four DISPUTE_UPDATED audits**, plus one upload preparation and one evidence-access POST; **nine record READ audits**, one uploaded object and one verified object. The provider outcome stayed awaiting response, with no resolution or confirmed chargeback. All28 prior disputes and all38 payments/38 attempts/31 refunds/37 invoices/eight ledger rows were unchanged. No page errors occurred and all four owned temporary sessions were removed. The generated evidence link was validated; external S3 and an actual provider submission were not tested.

## Backend and database boundaries

See [dispute handling contract](../../../backend/docs/dispute-handling-workspace.md). Added private audited current and eligible-operator reads; queue reads are now audited and dispute responses explicitly private/no-store. Existing write semantics and financial calculations are preserved.

All database writes were confined to the confirmed isolated `127.0.0.1:55480 / allied_work_aftercare_20261017_test` target under restricted runtime credentials. Tests added their own synthetic operators/capabilities and three disputes in total; those fixtures are retained. Existing accounts and grants were not changed. No application/shared database, schema, migration, database privilege, backup/restore, provider delivery, push or deployment operation ran. Unchanged60-migration evidence was reused; no new restore rehearsal or off-device backup claim is made.

## Files and evidence

Page/scope CSS; `work-dispute-handling.tsx`; compatible `dispute-work-queue.tsx` export; existing assignment/evidence/progress/provider/review/upload components; shell breadcrumb suppression; domain query/receipt and pending helpers; session invalidation redaction; generated API types; focused fixtures/unit/browser tests. Backend dispute schemas/router, policy OpenAPI registration and integration tests are updated.

Private review artifacts are under `C:/Users/PC/.codex/work-dispute-handling-*`: baseline/current/state/large-money PNGs, measures, production results, build log, API log, connected result and source hashes. They contain synthetic fixtures only. The full goal remains open; next is `/admin/finance-policy`, followed by remaining organisation, role regression and deployed verification.
