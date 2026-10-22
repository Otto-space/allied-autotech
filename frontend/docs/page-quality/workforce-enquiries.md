# Managed workforce enquiries — milestone 107

Status: locally accepted on 19 October 2026. Route `/admin/workforce/enquiries`. The full application redesign goal remains active.

## Outcome

A compact searchable queue replaces repeated per-record reply and assignment forms. Applied search/type/status filters, queue history, selected enquiry and conversation history persist in the URL through reload and Back. Named branches/assignees and readable states precede a selected conversation workspace. Original messages and customer-visible replies remain distinct; internal messages and private customer contact fields are excluded.

Customer Service, Sales Supervisor and Sales Cashier retain their actual scope. Reply and assignment use exact-change review, fresh access/record/candidate checks, current conversation preconditions and validated action receipts. Refresh retains harmless drafts; changed conversations require explicit review of the retained draft. Unknown results remain locked through refresh, reload and navigation. Independent reconciliation follows fresh inspection without replay. Denial and session changes clear private drafts; persistent markers store no message or reason text. Closed enquiries retain history without mutation controls.

## Design gate

Four native baselines preceded implementation. Three fresh concepts and the [locked specification](workforce-enquiries-oct-concepts/spec.md) define the complete queue, phone layout and expanded assignment. All concepts and final desktop/mobile/tablet and assignment captures were viewed.

Actual branding and role navigation replace generated shell examples. Quicksand UI, 28/24px main titles, 19px section headings, 14px content, 44px controls, visible borders, red focus/radio treatment and cool surfaces follow the specification. Desktop uses a table and conversation/action columns; tablet and phone progressively stack the workspace and expose labeled queue facts. Full staff references wrap to distinguish duplicate names. Real pagination availability replaces generated sample controls; history uses intrinsic height without empty filler. No unsupported workflow or decorative imagery was introduced.

The final visual pass corrected shared dashboard form variables overriding local red focus/radio styling. Computed focus and radio accent both resolve to `rgb(230, 3, 1)`. Selection moves focus into the conversation. Capture scripts use instant scroll positioning so smooth scrolling and fixed shell elements do not produce misleading full-page artifacts.

## Verification

| Gate                     | Evidence                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page behavior            | 27 distinct production-browser cases pass: three eligible roles, filtering, queue/history/staff paging, selection/reload/Back, exact replies/assignment, retained drafts, changed-message preflight, removed candidate, closed state, denied/mismatched access, malformed receipt, committed-response-loss recovery, loading and candidate empty/failure/retry states. |
| Responsive/accessibility | Seven widths (360/390/430/768/1024/1280/1440px), expanded assignment/long text at 320/1440px, keyboard radio selection and both uncertain-recovery states pass Axe checks. No horizontal overflow. Final affected visual/selection checks pass 10/10.                                                                                                                  |
| Regression               | Ten distinct checks cover combined Operations dashboard navigation, bookings/jobs/job detail at 1440px, job candidate assignment, quality controls and the four existing workforce queues. Existing enquiry fixtures and selectors were updated for the authoritative projection and table row semantics.                                                              |
| Helpers                  | Eleven query/scope/history/candidate/receipt units and two pending-marker identity/storage/redaction units pass.                                                                                                                                                                                                                                                       |
| API/database             | Seven scenarios, 19 successful reads, four successful changes and 23 matching audits; original data preserved and zero temporary sessions. See the [backend evidence and limits](../../../backend/docs/workforce-enquiries-workspace.md).                                                                                                                              |
| Connected browser/API    | All three eligible responsibilities; real history paging, reply, assignment and committed-lost-response reconciliation. Three changes and 28 audited reads produce 31 audits. Preserved original records and zero temporary sessions.                                                                                                                                  |
| Static/build             | Frontend/backend type checks, focused lint/format, generated OpenAPI/types/inventory, 314-path validation and 368-operation route coverage plus four infrastructure routes pass. Final production webpack build and standalone preparation exit zero. Ten runtime/generated-contract source hashes match the built snapshot.                                           |
| Runtime health           | Four final native widths verify page identity, meaningful content, successful filtering and no page errors, console warnings/errors or failed assets/API requests. Superseded Next.js page-navigation requests may end with `net::ERR_ABORTED`; these are recorded separately from unexpected failures.                                                                |

Initial browser execution passed 19/21 cases. Two test-only fixes waited for selected-URL navigation before reload and disambiguated a searchbox from its form. Focused execution passed those cases plus four added cases. Later state and regression runs exposed a punctuation encoding typo and exact-text selectors that no longer matched table cells containing dates; focused corrected checks pass. Successful business operations were not repeated. The API fixture's atomic setup failure and guarded resume are documented separately.

## Artifacts and remaining work

Implementation: `workforce-enquiries.tsx`, `workforce-enquiry-detail.tsx`, `workforce-enquiry-candidates.tsx`, scoped CSS, enquiry query/receipt/pending helpers, exact-route workspace dispatch and breadcrumb handling. Compatible backend changes, generated contracts and meaningful tests accompany the page.

External evidence: `C:/Users/PC/.codex/workforce-enquiries-{baseline,final,native,assignment-native,api,resumed,real,source-hashes}*` and dedicated browser/focused/final/states/regression output directories. Test screenshots and temporary scripts remain outside the repository. The root backend gap document records ADM-75.

No application/shared database, migration/grant, backup/restore, provider activation, push or deployment operation ran. Existing isolated schema verification was reused. Financial tables are empty; this is not populated-finance preservation evidence. Durable operation receipts, external delivery, physical devices, Safari/Firefox, production-scale data and deployed acceptance remain unverified.

Next page: `/admin/workforce/complaints`, followed by remaining managed queues, central owner checklist consolidation, application-wide role regression and deployed acceptance. Local page acceptance does not complete the overall goal.
